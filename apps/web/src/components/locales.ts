import type { MessageKey } from "@/messages/en";

export const LOCALES = [
  "en",
  "ar",
  "fr",
  "es",
  "it",
  "ru",
  "tr",
  "az",
  "bs",
  "sr",
  "uz",
  "ky",
  "id",
  "tl",
  "zh",
  "ug",
  "ja",
  "vi",
  "th",
  "km",
  "fa",
  "ku",
  "ps",
  "hi",
  "bn",
  "te",
  "ml",
  "as",
  "ta",
  "si",
  "ff",
] as const;

export type Locale = (typeof LOCALES)[number];
export type Messages = Record<MessageKey, string>;

export const LOCALE_COOKIE = "sirathicLocale";

const RTL_LOCALES: ReadonlySet<Locale> = new Set([
  "ar",
  "fa",
  "ku",
  "ps",
  "ug",
]);

type Placeholders<Text extends string> =
  Text extends `${string}{${infer Name}}${infer Rest}`
    ? Name | Placeholders<Rest>
    : never;

export type PlainKey = {
  [Key in MessageKey]: [Placeholders<Key>] extends [never] ? Key : never;
}[MessageKey];

export type Values<Key extends MessageKey> = [Placeholders<Key>] extends [never]
  ? []
  : [values: Record<Placeholders<Key>, string | number>];

export const hasLocale = (code: string): code is Locale =>
  LOCALES.some((locale) => locale === code);

export const isRtl = (locale: Locale) => RTL_LOCALES.has(locale);

export function translate<Key extends MessageKey>(
  messages: Messages | undefined,
  key: Key,
  ...[values]: Values<Key>
) {
  const text = messages?.[key] ?? key;
  return Object.entries<string | number>(values ?? {}).reduce(
    (filled, [name, value]) => filled.replaceAll(`{${name}}`, String(value)),
    text,
  );
}
