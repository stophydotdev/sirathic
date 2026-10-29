import type { Page } from "patchright";
import type { Filled, FillRequest } from "./protocol";
import { settled } from "./run";
import type { Session } from "./sessions";

const FILL_TIMEOUT_MS = 5_000;

export const onSite = (url: string, site: string) => {
  const host = URL.parse(url)?.hostname.replace(/^www\./u, "") ?? "";
  const bare = site.replace(/^www\./u, "");
  return host === bare || host.endsWith(`.${bare}`) || bare.endsWith(`.${host}`);
};

const put = (page: Page, target: string, value: string) => {
  const field = page.locator(`aria-ref=${target}`);
  return field
    .fill(value, { timeout: FILL_TIMEOUT_MS })
    .catch(() => field.selectOption(value, { timeout: FILL_TIMEOUT_MS }))
    .then(
      () => true,
      () => false,
    );
};

const clearSecrets = (secrets: ReadonlySet<string>) =>
  `(() => { const secrets = ${JSON.stringify([...secrets])}; for (const input of document.querySelectorAll("input")) if (secrets.includes(input.value)) input.value = ""; })()`;

export const cleared = ({ page, secrets }: Session) =>
  Promise.all(
    page.frames().map((frame) => frame.evaluate(clearSecrets(secrets)).catch(() => undefined)),
  );

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
        filled: await put(page, target, value),
      },
    ],
    Promise.resolve([]),
  );
  for (const [index, field] of fields.entries()) {
    if (!results[index]?.filled) session.held.set(field.target, { value: field.value, domain });
  }
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

export const check = async ({ page }: Session, targets: string[]) => ({
  missing: (
    await Promise.all(
      targets.map(async (target) =>
        (await page
          .locator(`aria-ref=${target}`)
          .count()
          .catch(() => 0)) > 0
          ? []
          : [target],
      ),
    )
  ).flat(),
});

export const refill = async (
  session: Session,
  fields: { from: string; to: string }[],
): Promise<Filled> => {
  const { page } = session;
  const results = await fields.reduce<Promise<Filled["fields"]>>(async (done, { from, to }) => {
    const held = session.held.get(from);
    const ok =
      held !== undefined && onSite(page.url(), held.domain) && (await put(page, to, held.value));
    if (ok) session.held.delete(from);
    return [...(await done), { target: to, filled: ok }];
  }, Promise.resolve([]));
  return { fields: results, submitted: false };
};
