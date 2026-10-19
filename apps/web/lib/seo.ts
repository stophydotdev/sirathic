import { LOCALES, type Locale } from "@/components/locales";

export const SITE = "https://sirathic.com";

export const QURAN_TRANSLATION_OF_LOCALE = new Map<Locale, number>([
  ["fr", 295],
  ["es", 152],
  ["tr", 148],
  ["id", 224],
  ["hi", 166],
  ["bn", 200],
]);

export const INDEXED_QURAN_LOCALES = LOCALES.filter(
  (locale) => locale === "en" || QURAN_TRANSLATION_OF_LOCALE.has(locale),
);

export const languagesOf = (path: string, locales: readonly Locale[]) =>
  Object.fromEntries([
    ...locales.map((locale) => [locale, `${SITE}/${locale}${path}`]),
    ["x-default", `${SITE}/en${path}`],
  ]);

export const alternatesOf = (
  lang: Locale,
  path: string,
  indexedLocales: readonly Locale[],
) =>
  indexedLocales.includes(lang)
    ? {
        canonical: `${SITE}/${lang}${path}`,
        languages: languagesOf(path, indexedLocales),
      }
    : { canonical: `${SITE}/en${path}` };
