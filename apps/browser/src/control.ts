import { z } from "zod";
import type { Filled, FillRequest, UserInput } from "./protocol";
import { settled } from "./run";
import type { Session } from "./sessions";

const FILL_TIMEOUT_MS = 5_000;
const TYPED_MIN_CHARS = 4;
const FOCUSED_VALUE =
  "(() => { const field = document.activeElement; return document.hasFocus() && field && 'value' in field ? String(field.value) : ''; })()";

const focusedValue = z.string().catch("");

export const onSite = (url: string, site: string) => {
  const host = URL.parse(url)?.hostname.replace(/^www\./u, "") ?? "";
  const bare = site.replace(/^www\./u, "");
  return host === bare || host.endsWith(`.${bare}`) || bare.endsWith(`.${host}`);
};

const clearSecrets = (secrets: ReadonlySet<string>) =>
  `(() => { const secrets = ${JSON.stringify([...secrets])}; for (const input of document.querySelectorAll("input")) if (secrets.includes(input.value)) input.value = ""; })()`;

export const cleared = ({ page, secrets }: Session) =>
  Promise.all(
    page.frames().map((frame) => frame.evaluate(clearSecrets(secrets)).catch(() => undefined)),
  );

export const control = async ({ page, secrets }: Session, input: UserInput) => {
  switch (input.kind) {
    case "click":
      await page.mouse.click(input.x, input.y);
      return;
    case "wheel":
      await page.mouse.move(input.x, input.y);
      await page.mouse.wheel(input.deltaX, input.deltaY);
      return;
    case "key":
      await page.keyboard.press(input.key);
      return;
    case "text": {
      await page.keyboard.insertText(input.text);
      const typed = await Promise.all(
        page
          .frames()
          .map(async (frame) =>
            focusedValue.parse(await frame.evaluate(FOCUSED_VALUE).catch(() => "")),
          ),
      );
      for (const value of typed) if (value.length >= TYPED_MIN_CHARS) secrets.add(value);
    }
  }
};

export const fill = async (
  session: Session,
  { domain, fields, submit }: Omit<FillRequest, "session">,
): Promise<Filled> => {
  const { page, secrets, hidden } = session;
  if (!onSite(page.url(), domain)) {
    throw new Error(
      `The page is on ${URL.parse(page.url())?.hostname ?? "another site"}, not ${domain}.`,
    );
  }
  const secret = fields.some((field) => field.secret);
  for (const field of fields) (field.secret ? secrets : hidden).add(field.value);
  const results = await fields.reduce<Promise<Filled["fields"]>>(
    async (done, { target, value }) => [
      ...(await done),
      {
        target,
        filled: await page
          .locator(`aria-ref=${target}`)
          .fill(value, { timeout: FILL_TIMEOUT_MS })
          .then(
            () => true,
            () => false,
          ),
      },
    ],
    Promise.resolve([]),
  );
  const last = fields.at(-1);
  const submitted =
    (submit || secret) && last !== undefined && results.every((field) => field.filled);
  if (submitted) await page.locator(`aria-ref=${last.target}`).press("Enter");
  if (secret) {
    await settled(session);
    await cleared(session);
  }
  return { fields: results, submitted };
};
