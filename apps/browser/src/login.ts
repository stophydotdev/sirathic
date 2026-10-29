import { cleared } from "./control";
import type { LoginRequest, LoginResult } from "./protocol";
import { settled } from "./run";
import type { Session } from "./sessions";

const FILL_TIMEOUT_MS = 5_000;
const PASSWORD = "input[type=password]:visible";
const USERNAME = [
  "input[autocomplete~=username]",
  "input[autocomplete~=email]",
  "input[type=email]",
  "input[name*=user i]",
  "input[name*=email i]",
  "input[name*=login i]",
  "input[id*=user i]",
  "input[id*=email i]",
  "input[id*=login i]",
]
  .map((selector) => `${selector}:visible`)
  .join(", ");
const CODE = [
  "input[autocomplete=one-time-code]",
  "input[name*=otp i]",
  "input[id*=otp i]",
  "input[name*=code i]",
  "input[id*=code i]",
]
  .map((selector) => `${selector}:visible`)
  .join(", ");

const onSite = (url: string, site: string) => {
  const host = URL.parse(url)?.hostname.replace(/^www\./u, "") ?? "";
  return host === site || host.endsWith(`.${site}`);
};

export const login = async (
  session: Session,
  { site, username, password, code }: LoginRequest,
): Promise<LoginResult> => {
  const result = async (status: LoginResult["status"]) => ({
    status,
    url: session.page.url(),
    title: await session.page.title().catch(() => ""),
  });
  const shows = (selector: string) =>
    session.page
      .locator(selector)
      .first()
      .isVisible()
      .catch(() => false);
  const enter = async (selector: string, value: string) => {
    const field = session.page.locator(selector).first();
    await field.fill(value, { timeout: FILL_TIMEOUT_MS });
    await field.press("Enter");
    await settled(session);
  };
  if (!onSite(session.page.url(), site)) return result("wrong-site");
  session.secrets.add(password);
  if (code) session.secrets.add(code);
  if (!(await shows(PASSWORD)) && !(await shows(USERNAME))) return result("no-fields");
  if (await shows(PASSWORD)) {
    if (await shows(USERNAME)) {
      await session.page.locator(USERNAME).first().fill(username, { timeout: FILL_TIMEOUT_MS });
    }
  } else {
    await enter(USERNAME, username);
    if (!onSite(session.page.url(), site)) return result("wrong-site");
  }
  if (await shows(PASSWORD)) await enter(PASSWORD, password);
  if (code && (await shows(CODE))) await enter(CODE, code);
  await cleared(session);
  if (await shows(PASSWORD)) return result("still-signing-in");
  if (await shows(CODE)) return result("needs-code");
  return result("signed-in");
};
