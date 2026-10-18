import { MESSAGES } from "../apps/web/messages/en";

const PLACEHOLDER = /\{\w+\}/gu;
const placeholders = (text: string) =>
  [...text.matchAll(PLACEHOLDER)]
    .map(([match]) => match)
    .toSorted()
    .join(" ");

const locales = process.argv.slice(2);
const loaded = await Promise.all(
  locales.map(async (locale) => ({
    locale,
    messages: (await import(`../apps/web/messages/${locale}.ts`)).default,
  })),
);
let problems = 0;
for (const { locale, messages } of loaded) {
  const translated = new Map<string, string>(Object.entries(messages));
  const issues: string[] = [];
  const same: string[] = [];
  for (const key of MESSAGES) {
    const text = translated.get(key);
    if (text === undefined) issues.push(`missing: ${key}`);
    else if (text.trim() === "") issues.push(`empty: ${key}`);
    else if (placeholders(text) !== placeholders(key)) {
      issues.push(`placeholders differ: ${key} => ${text}`);
    } else if (text === key && /[a-z]{4}/u.test(key)) {
      same.push(key);
    }
  }
  for (const key of translated.keys()) {
    if (!MESSAGES.some((known) => known === key)) issues.push(`extra: ${key}`);
  }
  problems += issues.length;
  console.log(
    `${locale}: ${issues.length === 0 ? "ok" : issues.join("\n  ")}${same.length > 0 ? `\n  same as English (check): ${same.join(" | ")}` : ""}`,
  );
}
process.exit(problems === 0 ? 0 : 1);
