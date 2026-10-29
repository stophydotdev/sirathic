import {
  type Action,
  clickInput,
  failure,
  findInput,
  navigateInput,
  pressInput,
  result,
  runCodeInput,
  selectInput,
  typeInput,
  waitForInput,
} from "@sirathic/browser/protocol";
import { env } from "@sirathic/env/server";
import { tool } from "ai";
import { z } from "zod";
import { fencedText } from "../chat/fence";

const TIMEOUT_MS = 90_000;

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
] as const;

const act = async (session: string, action: Action) => {
  const response = await fetch(new URL("/act", env.BROWSER_URL), {
    method: "POST",
    headers: { authorization: `Bearer ${env.BROWSER_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ session, action }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(failure.parse(body).error);
  return result.parse(body);
};

const pageText = (output: z.infer<typeof result>) => ({
  type: "text" as const,
  value: `### Page\n${output.url}\n${output.title}\n\n${fencedText(output.page)}`,
});

export function browserTools(session: string) {
  return {
    browser_navigate: tool({
      description:
        "Opens a URL in your browser and returns the page as an accessibility snapshot, where each element you can act on carries a ref like [ref=e12].",
      inputSchema: navigateInput,
      execute: (input) => act(session, { kind: "navigate", ...input }),
      toModelOutput: ({ output }) => pageText(output),
    }),
    browser_snapshot: tool({
      description:
        "Returns the current page as an accessibility snapshot with refs. Use it after a new URL or title, when you need a ref you don't have, or after a stale-ref error.",
      inputSchema: z.object({}),
      execute: () => act(session, { kind: "snapshot" }),
      toModelOutput: ({ output }) => pageText(output),
    }),
    browser_find: tool({
      description:
        "Finds the elements on the current page whose line in the snapshot mentions this text, with their refs. Cheaper than a full snapshot to locate one control.",
      inputSchema: findInput,
      execute: (input) => act(session, { kind: "find", ...input }),
      toModelOutput: ({ output }) => pageText(output),
    }),
    browser_click: tool({
      description:
        "Clicks an element. Returns what changed on the page, the whole new page after a navigation, or unchanged.",
      inputSchema: clickInput,
      execute: (input) => act(session, { kind: "click", ...input }),
      toModelOutput: ({ output }) => pageText(output),
    }),
    browser_type: tool({
      description:
        "Replaces the text in a field with this literal text, typed key by key. Set submit to press Enter after. Returns what changed.",
      inputSchema: typeInput,
      execute: (input) => act(session, { kind: "type", ...input }),
      toModelOutput: ({ output }) => pageText(output),
    }),
    browser_press: tool({
      description:
        "Presses one key, with modifiers like Control+A, on the focused element. Click a field first to focus it. Returns what changed.",
      inputSchema: pressInput,
      execute: (input) => act(session, { kind: "press", ...input }),
      toModelOutput: ({ output }) => pageText(output),
    }),
    browser_select: tool({
      description:
        "Picks options in a native <select> by value or label. For a custom dropdown, click it open, then click the option.",
      inputSchema: selectInput,
      execute: (input) => act(session, { kind: "select", ...input }),
      toModelOutput: ({ output }) => pageText(output),
    }),
    browser_wait_for: tool({
      description:
        "Waits for content that arrives later: until text shows, until text is gone, or a fixed number of seconds. Actions already wait for the page to settle, so don't call it after a navigate, click or type.",
      inputSchema: waitForInput,
      execute: (input) => act(session, { kind: "wait_for", ...input }),
      toModelOutput: ({ output }) => pageText(output),
    }),
    browser_run_code: tool({
      description:
        "Runs JavaScript in the page and returns its JSON result, for reading many values at once, like every row of a table. It can change the page, so only read with it.",
      inputSchema: runCodeInput,
      execute: (input) => act(session, { kind: "run_code", ...input }),
      toModelOutput: ({ output }) => pageText(output),
    }),
  };
}
