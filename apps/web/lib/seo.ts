import type { Locale } from "@/components/locales";

export const SITE = "https://sirathic.com";

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
