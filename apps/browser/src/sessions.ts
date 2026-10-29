import { type Browser, type BrowserContext, chromium, type Page } from "patchright";
import { BLOCKED_URLS, isPrivateUrl } from "./blocked";
import { closable, HOLD_MS, IDLE_MS, MAKE_ROOM_IDLE_MS, RESTORE_MS } from "./idle";
import { forgetLogins, saveLogins, savedLogins } from "./logins";
import type { TaughtStep } from "./protocol";
import { closeScreen, openScreen, SCREEN, type Screen } from "./screen";

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
  "--no-default-browser-check",
  "--hide-crash-restore-bubble",
  "--window-position=0,0",
  `--window-size=${SCREEN.width},${SCREEN.height}`,
];
const MAX_SESSIONS = 25;
const SAVE_DELAY_MS = 1_000;
const SWEEP_MS = 15_000;
const TYPED_MIN_CHARS = 4;
const FIELD_VALUES =
  "(() => [...document.querySelectorAll('input, textarea')].filter((field) => !['hidden', 'submit', 'button', 'checkbox', 'radio', 'file'].includes(field.type)).map((field) => String(field.value)))()";

export class BusyError extends Error {
  override name = "BusyError";
}

export class ClosedError extends Error {
  override name = "ClosedError";
}

export class InUseError extends Error {
  override name = "InUseError";
}

export type Session = {
  browser: Browser;
  context: BrowserContext;
  screen: Screen;
  page: Page;
  seen: string;
  lastUsed: number;
  queue: Promise<unknown>;
  inFlight: number;
  idleSince: number;
  saveTimer?: ReturnType<typeof setTimeout>;
  secrets: Set<string>;
  hidden: Set<string>;
  controllers: number;
  typedBefore: Set<string>;
  holdUntil: number;
  held: Map<string, { value: string; domain: string }>;
  teaching?: TaughtStep[];
};

export const quietFor = (session: Session) =>
  session.inFlight > 0 ? 0 : Date.now() - session.idleSince;

const sessions = new Map<string, Promise<Session>>();

const blockAdsAndTrackers = async (page: Page) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setBlockedURLs", { urls: BLOCKED_URLS });
};

const open = async (key: string): Promise<Session> => {
  const screen = await openScreen();
  const browser = await chromium
    .launch({ headless: false, executablePath: CHROME_PATH, args: ARGS, env: screen.env })
    .catch((error: Error) => {
      closeScreen(screen);
      throw error;
    });
  const saved = await savedLogins(key);
  const context = await browser.newContext({
    viewport: null,
    locale: "en-US",
    storageState: saved && { cookies: saved.cookies, origins: saved.origins },
  });
  await context.route(
    (url) => isPrivateUrl(url.href),
    (route) => route.abort("blockedbyclient"),
  );
  const page = await context.newPage();
  await blockAdsAndTrackers(page);
  if (saved?.page && Date.now() - saved.page.at < RESTORE_MS && !isPrivateUrl(saved.page.url)) {
    await page.goto(saved.page.url, { waitUntil: "domcontentloaded" }).catch(() => undefined);
  }
  const session: Session = {
    browser,
    context,
    screen,
    page,
    seen: "",
    lastUsed: Date.now(),
    queue: Promise.resolve(),
    inFlight: 0,
    idleSince: Date.now(),
    secrets: new Set(),
    hidden: new Set(),
    controllers: 0,
    typedBefore: new Set(),
    holdUntil: 0,
    held: new Map(),
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
  browser.on("disconnected", () => {
    sessions.delete(key);
    closeScreen(screen);
  });
  return session;
};

const frontPage = async (context: BrowserContext) => {
  const pages = context.pages();
  if (pages.length < 2) return pages[0];
  const shown = await Promise.all(
    pages.map((page) => page.evaluate("document.visibilityState").catch(() => "hidden")),
  );
  return pages[shown.indexOf("visible")];
};

const saveSoon = (key: string, session: Session) => {
  clearTimeout(session.saveTimer);
  session.saveTimer = setTimeout(
    () => void saveLogins(key, session.context, session.page.url()).catch(() => undefined),
    SAVE_DELAY_MS,
  );
};

const queued = async <T>(key: string, session: Session, work: (session: Session) => Promise<T>) => {
  session.page =
    (await frontPage(session.context)) ??
    (session.page.isClosed() ? await session.context.newPage() : session.page);
  const run = session.queue.then(() => work(session));
  session.queue = run.catch(() => undefined);
  session.lastUsed = Date.now();
  session.holdUntil = 0;
  return run.finally(() => {
    session.lastUsed = Date.now();
    saveSoon(key, session);
  });
};

export const existing = (key: string) => sessions.get(key)?.catch(() => undefined);

const closed = async (key: string, session: Session) => {
  clearTimeout(session.saveTimer);
  sessions.delete(key);
  await session.browser.close().catch(() => undefined);
  closeScreen(session.screen);
};

const putAway = async (key: string, session: Session) => {
  await saveLogins(key, session.context, session.page.url()).catch(() => undefined);
  await closed(key, session);
};

const makeRoom = async () => {
  const now = Date.now();
  const running = await Promise.all(
    [...sessions].map(async ([key, pending]) => ({
      key,
      session: await pending.catch(() => undefined),
    })),
  );
  const idlest = running
    .flatMap(({ key, session }) =>
      session && closable(session, now, MAKE_ROOM_IDLE_MS) ? [{ key, session }] : [],
    )
    .toSorted((a, b) => a.session.lastUsed - b.session.lastUsed)[0];
  if (!idlest) return false;
  await putAway(idlest.key, idlest.session);
  return true;
};

export const inSession = async <T>(key: string, work: (session: Session) => Promise<T>) => {
  let pending = sessions.get(key);
  if (!pending) {
    if (sessions.size >= MAX_SESSIONS && !(await makeRoom())) {
      throw new BusyError("The browser is busy with other people's tasks. Try again in a minute.");
    }
    pending = open(key);
    sessions.set(key, pending);
    pending.catch(() => sessions.delete(key));
  }
  return queued(key, await pending, (session) => {
    if (session.controllers > 0) {
      throw new InUseError(
        "The person is using your browser right now. Stop and wait until they say they're done.",
      );
    }
    return work(session);
  });
};

export const pageOf = async (key: string) => {
  const session = await existing(key);
  if (!session) throw new ClosedError("Your bot's browser is closed.");
  return { url: session.page.url(), title: await session.page.title().catch(() => "") };
};

export const hold = async (key: string) => {
  const session = await existing(key);
  if (session) session.holdUntil = Date.now() + HOLD_MS;
};

export const inOpenSession = async <T>(key: string, work: (session: Session) => Promise<T>) => {
  const session = await existing(key);
  if (!session) throw new ClosedError("Your bot's browser is closed.");
  return queued(key, session, work);
};

const fieldValues = async ({ context }: Session) =>
  (
    await Promise.all(
      context
        .pages()
        .flatMap((page) => page.frames())
        .map((frame) => frame.evaluate<string[]>(FIELD_VALUES).catch(() => [])),
    )
  ).flat();

export const startControl = async (session: Session) => {
  session.controllers += 1;
  session.typedBefore = new Set(await fieldValues(session));
};

export const endControl = async (session: Session) => {
  for (const value of await fieldValues(session)) {
    if (value.length >= TYPED_MIN_CHARS && !session.typedBefore.has(value)) {
      session.secrets.add(value);
    }
  }
  session.controllers = Math.max(0, session.controllers - 1);
};

export const forget = async (key: string) => {
  const session = await existing(key);
  if (session) await closed(key, session);
  await forgetLogins(key);
};

const sweep = async () => {
  const now = Date.now();
  await Promise.all(
    [...sessions].map(async ([key, pending]) => {
      const session = await pending.catch(() => undefined);
      if (session && closable(session, now, IDLE_MS)) await putAway(key, session);
    }),
  );
};

setInterval(() => void sweep(), SWEEP_MS).unref();

export const openSessions = () => sessions.size;
