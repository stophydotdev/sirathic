import { type Browser, type BrowserContext, chromium, type Page } from "patchright";
import { BLOCKED_URLS } from "./blocked";

const CHROME_PATH = "/usr/bin/google-chrome-stable";
const ARGS = [
  "--disable-dev-shm-usage",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--disable-gpu-compositing",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--disable-extensions",
  "--disable-component-update",
  "--mute-audio",
  "--no-first-run",
];
const VIEWPORT = { width: 1280, height: 800 };
const MAX_SESSIONS = 8;
const SESSION_IDLE_MS = 5 * 60_000;
const BROWSER_IDLE_MS = 60_000;
const SWEEP_MS = 15_000;

export class BusyError extends Error {
  override name = "BusyError";
}

export type Session = {
  context: BrowserContext;
  page: Page;
  seen: string;
  lastUsed: number;
  queue: Promise<unknown>;
  inFlight: number;
  idleSince: number;
};

export const quietFor = (session: Session) =>
  session.inFlight > 0 ? 0 : Date.now() - session.idleSince;

const sessions = new Map<string, Promise<Session>>();
let chrome: Promise<Browser> | undefined;
let emptySince = Date.now();

const launched = () => {
  if (chrome) return chrome;
  const launching = chromium.launch({ headless: false, executablePath: CHROME_PATH, args: ARGS });
  chrome = launching;
  launching.then(
    (browser) =>
      browser.on("disconnected", () => {
        if (chrome === launching) chrome = undefined;
        sessions.clear();
      }),
    () => {
      if (chrome === launching) chrome = undefined;
    },
  );
  return launching;
};

const blockAdsAndTrackers = async (page: Page) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setBlockedURLs", { urls: BLOCKED_URLS });
};

const open = async (key: string): Promise<Session> => {
  const context = await (await launched()).newContext({ viewport: VIEWPORT, locale: "en-US" });
  const page = await context.newPage();
  await blockAdsAndTrackers(page);
  const session: Session = {
    context,
    page,
    seen: "",
    lastUsed: Date.now(),
    queue: Promise.resolve(),
    inFlight: 0,
    idleSince: Date.now(),
  };
  const finished = () => {
    session.inFlight = Math.max(0, session.inFlight - 1);
    if (session.inFlight === 0) session.idleSince = Date.now();
  };
  context.on("request", () => {
    session.inFlight += 1;
  });
  context.on("requestfinished", finished);
  context.on("requestfailed", finished);
  context.on("page", (opened) => {
    session.page = opened;
    void blockAdsAndTrackers(opened).catch(() => undefined);
  });
  context.on("close", () => sessions.delete(key));
  return session;
};

export const inSession = async <T>(key: string, work: (session: Session) => Promise<T>) => {
  let pending = sessions.get(key);
  if (!pending) {
    if (sessions.size >= MAX_SESSIONS) {
      throw new BusyError("The browser is busy with other people's tasks. Try again in a minute.");
    }
    pending = open(key);
    sessions.set(key, pending);
    pending.catch(() => sessions.delete(key));
  }
  const session = await pending;
  if (session.page.isClosed()) {
    session.page = session.context.pages().at(-1) ?? (await session.context.newPage());
  }
  const run = session.queue.then(() => work(session));
  session.queue = run.catch(() => undefined);
  session.lastUsed = Date.now();
  return run.finally(() => {
    session.lastUsed = Date.now();
  });
};

const sweep = async () => {
  const now = Date.now();
  await Promise.all(
    [...sessions].map(async ([key, pending]) => {
      const session = await pending.catch(() => undefined);
      if (session && now - session.lastUsed > SESSION_IDLE_MS) {
        sessions.delete(key);
        await session.context.close().catch(() => undefined);
      }
    }),
  );
  if (sessions.size > 0) emptySince = now;
  else if (chrome && now - emptySince > BROWSER_IDLE_MS) {
    const closing = chrome;
    chrome = undefined;
    await (await closing).close().catch(() => undefined);
  }
};

setInterval(() => void sweep(), SWEEP_MS).unref();

export const openSessions = () => sessions.size;
