import type { Page } from "patchright";
import { z } from "zod";
import type { Action, Result } from "./protocol";
import { quietFor, type Session } from "./sessions";

const PAGE_CHARS = 15_000;
const SETTLE_MS = 3_000;
const QUIET_MS = 500;
const QUIET_MAX_MS = 2_000;
const SETTLE_POLL_MS = 250;
const SNAPSHOT_TIMEOUT_MS = 5_000;
const ACTION_TIMEOUT_MS = 5_000;
const WAIT_TIMEOUT_MS = 10_000;
const NAVIGATE_TIMEOUT_MS = 30_000;
const LOAD_TIMEOUT_MS = 5_000;
const KEY_DELAY_MS = 40;
const SECRET_MIN_CHARS = 4;
const COOKIE_MIN_CHARS = 8;
const MASK = "••••••";
const INPUTS = "[...document.querySelectorAll('input')].map((input) => [input.type, input.value])";

const inputValues = z.array(z.tuple([z.string(), z.string()]));

const inputsOf = async (page: Page) =>
  (
    await Promise.all(
      page.frames().map((frame) =>
        frame.evaluate(INPUTS).then(
          (values) => inputValues.safeParse(values).data ?? [],
          () => [],
        ),
      ),
    )
  ).flat();

const secretsOf = async ({ page, context, secrets }: Session) => {
  const passwords = (await inputsOf(page)).flatMap(([type, value]) =>
    type === "password" ? [value] : [],
  );
  const cookies = (await context.cookies().catch(() => []))
    .map((cookie) => cookie.value)
    .filter((value) => value.length >= COOKIE_MIN_CHARS);
  return [...secrets, ...passwords, ...cookies].filter((value) => value.length >= SECRET_MIN_CHARS);
};

const secretInField = async ({ page, secrets }: Session) =>
  (await inputsOf(page)).some(
    ([type, value]) => (type === "password" && value !== "") || secrets.has(value),
  );

const masked = (text: string, secrets: readonly string[]) =>
  secrets.reduce((out, secret) => out.replaceAll(secret, MASK), text);

const STRUCTURAL =
  /^\s*- (?:generic|list|listitem|group|region|none|presentation|separator|table|rowgroup|row) \[ref=\w+\](?: \[cursor=pointer\])?:?$/u;
const INTERACTIVE =
  /\b(?:button|link|textbox|searchbox|combobox|checkbox|radio|option|menuitem|tab|switch|slider|spinbutton)\b.*\[ref=/u;

const snapshotOf = async (page: Page) =>
  (await page.ariaSnapshot({ mode: "ai", timeout: SNAPSHOT_TIMEOUT_MS }))
    .split("\n")
    .filter((line) => !STRUCTURAL.test(line))
    .join("\n");

const firstLine = (error: Error) => error.message.split("\n")[0] ?? error.message;

export const reasonOf = (error: Error) => {
  const covering = /- (<[^\n]*?>)[^\n]*? intercepts pointer events/u.exec(error.message)?.[1];
  if (covering) {
    return `${firstLine(error)} ${covering} covers it: close, accept or scroll past that first, then take a fresh snapshot.`;
  }
  return /Timeout \d+ms exceeded/u.test(error.message) && /aria-ref=/u.test(error.message)
    ? `${firstLine(error)} The ref may be gone or hidden: take a new browser_snapshot or use browser_find, then try a ref from it.`
    : firstLine(error);
};

const stable = async (page: Page, last: string, until: number): Promise<string> => {
  if (Date.now() >= until) return last;
  await page.waitForTimeout(SETTLE_POLL_MS);
  const now = await snapshotOf(page).catch(() => "");
  return now === last ? now : stable(page, now, until);
};

const quiet = async (session: Session, until: number): Promise<void> => {
  if (Date.now() >= until || quietFor(session) >= QUIET_MS) return;
  await session.page.waitForTimeout(SETTLE_POLL_MS);
  return quiet(session, until);
};

export const settled = async (session: Session) => {
  await quiet(session, Date.now() + QUIET_MAX_MS);
  return stable(
    session.page,
    await snapshotOf(session.page).catch(() => ""),
    Date.now() + SETTLE_MS,
  );
};

const clipped = (text: string) =>
  text.length <= PAGE_CHARS
    ? text
    : `${text.slice(0, PAGE_CHARS)}\n[Cut at ${PAGE_CHARS} characters. Use browser_find to reach the rest.]`;

const changesFrom = (before: string, after: string) => {
  const old = new Set(before.split("\n"));
  return after
    .split("\n")
    .filter((line) => !old.has(line))
    .join("\n");
};

const titleOf = (page: Page) => page.title().catch(() => "");

const pageAfter = async (session: Session, startUrl?: string): Promise<Result> => {
  const snapshot = await settled(session);
  const { page } = session;
  const whole = startUrl === undefined || startUrl !== page.url();
  const changes = whole ? snapshot : changesFrom(session.seen, snapshot);
  session.seen = snapshot;
  return {
    url: page.url(),
    title: await titleOf(page),
    page: whole ? clipped(snapshot) : changes ? `Changed:\n${clipped(changes)}` : "unchanged",
  };
};

type Step = Extract<Action, { kind: "click" | "type" | "press" | "select" }>;

const perform = async (page: Page, step: Step) => {
  const element = (target: string) => page.locator(`aria-ref=${target}`);
  switch (step.kind) {
    case "click":
      await element(step.target).click({ timeout: ACTION_TIMEOUT_MS });
      return;
    case "type":
      await element(step.target).fill("", { timeout: ACTION_TIMEOUT_MS });
      await page.keyboard.type(step.text, { delay: KEY_DELAY_MS });
      if (step.submit) await page.keyboard.press("Enter");
      return;
    case "press":
      await page.keyboard.press(step.key);
      return;
    case "select":
      await element(step.target).selectOption(step.values, { timeout: ACTION_TIMEOUT_MS });
  }
};

const failedStep = async (session: Session, steps: readonly Step[]) =>
  steps.reduce<Promise<string | undefined>>(
    async (failed, step, index) =>
      (await failed) ??
      perform(session.page, step).then(
        () => undefined,
        (error: Error) =>
          `Step ${index + 1} (${step.kind}) failed: ${reasonOf(error)} The steps after it did not run.`,
      ),
    Promise.resolve(undefined),
  );

const unmasked = async (session: Session, action: Action): Promise<Result> => {
  const { page } = session;
  const startUrl = page.url();
  switch (action.kind) {
    case "navigate":
      await page.goto(action.url, { waitUntil: "domcontentloaded", timeout: NAVIGATE_TIMEOUT_MS });
      await page.waitForLoadState("load", { timeout: LOAD_TIMEOUT_MS }).catch(() => undefined);
      return pageAfter(session);
    case "snapshot": {
      const after = await pageAfter(session);
      if (!action.interactive) return after;
      const controls = session.seen.split("\n").filter((line) => INTERACTIVE.test(line));
      return { ...after, page: clipped(controls.join("\n")) };
    }
    case "find": {
      const snapshot = await snapshotOf(page);
      session.seen = snapshot;
      const needle = action.text.toLowerCase();
      const lines = snapshot
        .split("\n")
        .filter((line) => line.includes("[ref=") && line.toLowerCase().includes(needle));
      return {
        url: page.url(),
        title: await titleOf(page),
        page:
          lines.length > 0
            ? clipped(lines.join("\n"))
            : `Nothing on the page mentions "${action.text}".`,
      };
    }
    case "click":
    case "type":
    case "press":
    case "select":
      await perform(page, action);
      return pageAfter(session, startUrl);
    case "batch": {
      const failed = await failedStep(session, action.steps);
      const after = await pageAfter(session, startUrl);
      return failed ? { ...after, page: `${failed}\n\n${after.page}` } : after;
    }
    case "wait_for":
      if (action.text) {
        await page
          .getByText(action.text)
          .first()
          .waitFor({ state: "visible", timeout: WAIT_TIMEOUT_MS });
      }
      if (action.textGone) {
        await page
          .getByText(action.textGone)
          .first()
          .waitFor({ state: "hidden", timeout: WAIT_TIMEOUT_MS });
      }
      if (action.time) await page.waitForTimeout(action.time * 1_000);
      return pageAfter(session, startUrl);
    case "run_code": {
      if (await secretInField(session)) {
        throw new Error(
          "browser_run_code is off while a password or other secret is in a field on this page. Submit the form or leave the page first.",
        );
      }
      const value: unknown = await page.evaluate(
        `(async () => { const code = (${action.code}); return typeof code === "function" ? await code() : await code; })()`,
      );
      return {
        url: page.url(),
        title: await titleOf(page),
        page: clipped(JSON.stringify(value) ?? "undefined"),
      };
    }
  }
};

export const run = async (session: Session, action: Action): Promise<Result> => {
  const result = await unmasked(session, action);
  const secrets = await secretsOf(session);
  return {
    url: masked(result.url, secrets),
    title: masked(result.title, secrets),
    page: masked(result.page, secrets),
  };
};
