import {
  type Action,
  batchInput,
  browserHelp,
  clickInput,
  failure,
  type FillRequest,
  filled,
  findInput,
  loginResult,
  pageInfo,
  pressInput,
  result,
  runCodeInput,
  selectInput,
  type ServiceRequest,
  snapshotInput,
  typeInput,
  type UserInput,
  userForm,
  waitForInput,
} from "@sirathic/browser/protocol";
import { publicUrl } from "@sirathic/core/web/url";
import { env } from "@sirathic/env/server";
import { tool } from "ai";
import { z } from "zod";
import { fencedText } from "../chat/fence";
import { StatusError } from "../http";
import { loginFor } from "../vault/vault";
import type { BotScope } from "./tools";

const TIMEOUT_MS = 90_000;

export const USER_FORM = "request_user_form";
export const BROWSER_HELP = "request_browser_help";
const VAULT_SIGN_IN = "vault_sign_in";

export const BROWSER_TOOLS = [
  "browser_navigate",
  "browser_snapshot",
  "browser_find",
  "browser_click",
  "browser_type",
  "browser_press",
  "browser_select",
  "browser_wait_for",
  "browser_run_code",
  "browser_batch",
  VAULT_SIGN_IN,
  USER_FORM,
  BROWSER_HELP,
] as const;

const sessionOf = (botId: string) => `bot:${botId}`;

const authorization = { authorization: `Bearer ${env.BROWSER_TOKEN}` };

const statusOf = (status: number) =>
  status === 400 || status === 404 ? status : status === 503 ? 429 : 502;

const service = async (path: string, body: ServiceRequest) => {
  const response = await fetch(new URL(path, env.BROWSER_URL), {
    method: "POST",
    headers: { ...authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    const { error } = failure.parse(await response.json());
    throw new StatusError(statusOf(response.status), error);
  }
  return response;
};

const act = async (botId: string, action: Action) =>
  result.parse(await (await service("/act", { session: sessionOf(botId), action })).json());

export const fillBrowser = async (botId: string, form: Omit<FillRequest, "session">) =>
  filled.parse(await (await service("/fill", { session: sessionOf(botId), ...form })).json());

export const controlBrowser = (botId: string, input: UserInput) =>
  service("/input", { session: sessionOf(botId), input });

const browserPage = async (botId: string) =>
  pageInfo.parse(await (await service("/page", { session: sessionOf(botId) })).json());

const SIGN_IN_NOTES = {
  "signed-in": (site: string, from: string) =>
    `Signed in on ${site} with the login from ${from}. Take a fresh snapshot to continue.`,
  "still-signing-in": (site: string, from: string) =>
    `The page still shows a sign-in form after the login from ${from} for ${site} was used, so it may be wrong or out of date. Tell the user to update it, or send request_user_form.`,
  "needs-code": (site: string, from: string) =>
    `The site asks for a one-time code and ${from} has no two-step key for ${site}. Read it from the user's mail if a mail plugin is connected, or send request_user_form for the code.`,
  "no-fields": () => "This page has no sign-in fields. Open the site's sign-in page first.",
  "wrong-site": (site: string) => `The page is not on ${site}, so the saved login was not used.`,
} satisfies Record<z.infer<typeof loginResult>["status"], (site: string, from: string) => string>;

const vaultSignIn = async ({ id, owner }: BotScope) => {
  const host = URL.parse((await browserPage(id)).url)?.hostname ?? "";
  const saved = await loginFor(owner, host);
  if (!saved) {
    return `No login is saved in the vault or 1Password for ${host || "this page"}. Send request_user_form instead.`;
  }
  const { source, ...login } = saved;
  const { status } = loginResult.parse(
    await (await service("/login", { session: sessionOf(id), ...login })).json(),
  );
  return SIGN_IN_NOTES[status](login.site, source === "vault" ? "the user's vault" : "1Password");
};

export const forgetBrowser = (botId: string) => service("/forget", { session: sessionOf(botId) });

export const watchBrowser = (botId: string, hungUp: AbortSignal) => {
  const url = new URL("/view", env.BROWSER_URL);
  url.searchParams.set("session", sessionOf(botId));
  return fetch(url, { headers: authorization, signal: hungUp });
};

const pageText = (output: z.infer<typeof result>) => ({
  type: "text" as const,
  value: `### Page\n${output.url}\n${output.title}\n\n${fencedText(output.page)}`,
});

export function browserTools(scope: BotScope) {
  const botId = scope.id;
  return {
    [VAULT_SIGN_IN]: tool({
      description:
        "Signs in on the page your browser has open with a login the user saved for that website, in their vault or their connected 1Password. It finds the fields, fills and submits them, and enters a two-step code when one is saved, all without you seeing the username, password or code. Use it first on any sign-in page; when nothing is saved for the site, send request_user_form. It reports whether the sign-in went through.",
      inputSchema: z.object({}),
      execute: () => vaultSignIn(scope),
    }),
    [USER_FORM]: tool({
      description:
        "Shows the user a Secure Form in the chat for typed details only they have, like a login, a one-time code, an address or card details, and fills what they type straight into the page in your browser. Every value is write-only: you get back only which fields were filled. Take a fresh snapshot first and give every field its target ref from that snapshot, embedded and cross-origin fields included. Set reason to auth for a sign-in. Tell the user in one line that what they type goes straight into the page and you never see it. The form ends your turn, and their receipt comes as their next message. A form with a secret field fills, submits the page's form and clears the secret from the page, so after the receipt take a fresh snapshot to see where it landed. Other forms only fill: after the receipt, take a fresh snapshot, then click the site's own continue button yourself. Set submit only for a one-shot code step whose only field is the code. A dismissed form is a decline, so don't send the same form again.",
      inputSchema: userForm,
      execute: async () => ({ shown: true }),
    }),
    [BROWSER_HELP]: tool({
      description:
        "Hands your browser to the user for a step a form cannot do: single sign-on through another company's sign-in page, a passkey, a captcha you tried and could not get past, an approval on another app or device, a QR code, a bank or 3DS confirmation after the card is entered, a field the Secure Form could not fill, or a sign-in the user prefers to do themselves. A typed login, address, card, or one-time code goes to request_user_form first. Pass one short instruction; it is shown in chat with a button that opens your browser, then your turn ends. The user does the step and tells you they're done, so start by taking a fresh browser_snapshot to see what they changed. When the user signs in on your browser, you never see their password or code.",
      inputSchema: browserHelp,
      execute: async () => ({ shown: true }),
    }),
    browser_navigate: tool({
      description:
        "Opens a URL in your browser and returns the page as an accessibility snapshot, where each element you can act on carries a ref like [ref=e12].",
      inputSchema: z.object({ url: publicUrl }),
      execute: (input) => act(botId, { kind: "navigate", ...input }),
      toModelOutput: ({ output }) => pageText(output),
    }),
    browser_snapshot: tool({
      description:
        "Returns the current page as an accessibility snapshot with refs. Use it after a new URL or title, when you need a ref you don't have, or after a stale-ref error. Set interactive when you only need refs to act on, such as the fields of a form.",
      inputSchema: snapshotInput,
      execute: (input) => act(botId, { kind: "snapshot", ...input }),
      toModelOutput: ({ output }) => pageText(output),
    }),
    browser_find: tool({
      description:
        "Finds the elements on the current page whose line in the snapshot mentions this text, with their refs. Cheaper than a full snapshot to locate one control.",
      inputSchema: findInput,
      execute: (input) => act(botId, { kind: "find", ...input }),
      toModelOutput: ({ output }) => pageText(output),
    }),
    browser_click: tool({
      description:
        "Clicks an element. Returns what changed on the page, the whole new page after a navigation, or unchanged.",
      inputSchema: clickInput,
      execute: (input) => act(botId, { kind: "click", ...input }),
      toModelOutput: ({ output }) => pageText(output),
    }),
    browser_type: tool({
      description:
        "Replaces the text in a field with this literal text, typed key by key. Set submit to press Enter after. Returns what changed.",
      inputSchema: typeInput,
      execute: (input) => act(botId, { kind: "type", ...input }),
      toModelOutput: ({ output }) => pageText(output),
    }),
    browser_press: tool({
      description:
        "Presses one key, with modifiers like Control+A, on the focused element. Click a field first to focus it. Returns what changed.",
      inputSchema: pressInput,
      execute: (input) => act(botId, { kind: "press", ...input }),
      toModelOutput: ({ output }) => pageText(output),
    }),
    browser_select: tool({
      description:
        "Picks options in a native <select> by value or label. For a custom dropdown, click it open, then click the option.",
      inputSchema: selectInput,
      execute: (input) => act(botId, { kind: "select", ...input }),
      toModelOutput: ({ output }) => pageText(output),
    }),
    browser_wait_for: tool({
      description:
        "Waits for content that arrives later: until text shows, until text is gone, or a fixed number of seconds. Actions already wait for the page to settle, so don't call it after a navigate, click or type.",
      inputSchema: waitForInput,
      execute: (input) => act(botId, { kind: "wait_for", ...input }),
      toModelOutput: ({ output }) => pageText(output),
    }),
    browser_batch: tool({
      description:
        "Runs several click, type, press and select steps in order in one call, like filling each field of a form and then clicking its button. Use refs you already hold. It stops at the first step that fails and says which. Returns what changed after the last step.",
      inputSchema: batchInput,
      execute: (input) => act(botId, { kind: "batch", ...input }),
      toModelOutput: ({ output }) => pageText(output),
    }),
    browser_run_code: tool({
      description:
        "Runs JavaScript in the page and returns its JSON result, for reading many values at once, like every row of a table. It can change the page, so only read with it.",
      inputSchema: runCodeInput,
      execute: (input) => act(botId, { kind: "run_code", ...input }),
      toModelOutput: ({ output }) => pageText(output),
    }),
  };
}
