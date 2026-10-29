import type { Page } from "patchright";
import type { Action, Result } from "./protocol";
import { quietFor, type Session } from "./sessions";

const PAGE_CHARS = 15_000;
const SETTLE_MS = 3_000;
const QUIET_MS = 500;
const QUIET_MAX_MS = 2_000;
const SETTLE_POLL_MS = 250;
const SNAPSHOT_TIMEOUT_MS = 5_000;
const ACTION_TIMEOUT_MS = 10_000;
const WAIT_TIMEOUT_MS = 10_000;
const NAVIGATE_TIMEOUT_MS = 30_000;
const LOAD_TIMEOUT_MS = 5_000;
const KEY_DELAY_MS = 40;

const snapshotOf = (page: Page) => page.ariaSnapshot({ mode: "ai", timeout: SNAPSHOT_TIMEOUT_MS });

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

const settled = async (session: Session) => {
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

export const run = async (session: Session, action: Action): Promise<Result> => {
  const { page } = session;
  const startUrl = page.url();
  const element = (target: string) => page.locator(`aria-ref=${target}`);
  switch (action.kind) {
    case "navigate":
      await page.goto(action.url, { waitUntil: "domcontentloaded", timeout: NAVIGATE_TIMEOUT_MS });
      await page.waitForLoadState("load", { timeout: LOAD_TIMEOUT_MS }).catch(() => undefined);
      return pageAfter(session);
    case "snapshot":
      return pageAfter(session);
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
      await element(action.target).click({ timeout: ACTION_TIMEOUT_MS });
      return pageAfter(session, startUrl);
    case "type":
      await element(action.target).fill("", { timeout: ACTION_TIMEOUT_MS });
      await page.keyboard.type(action.text, { delay: KEY_DELAY_MS });
      if (action.submit) await page.keyboard.press("Enter");
      return pageAfter(session, startUrl);
    case "press":
      await page.keyboard.press(action.key);
      return pageAfter(session, startUrl);
    case "select":
      await element(action.target).selectOption(action.values, { timeout: ACTION_TIMEOUT_MS });
      return pageAfter(session, startUrl);
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
