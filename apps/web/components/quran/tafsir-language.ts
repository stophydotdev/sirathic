import type { api } from "@/lib/trpc";
import { create } from "zustand";

export type TafsirLanguage = Awaited<
  ReturnType<typeof api.quran.index.query>
>["tafsirLanguages"][number];

const STORAGE_KEY = "sirathicTafsirLanguage";
const englishNames = new Intl.DisplayNames(["en"], { type: "language" });
const FLAGS = new Map<string, string>([
  ["ar", "sa"],
  ["as", "in"],
  ["az", "az"],
  ["bn", "bd"],
  ["bs", "ba"],
  ["en", "gb"],
  ["es", "es"],
  ["fa", "ir"],
  ["fr", "fr"],
  ["hi", "in"],
  ["id", "id"],
  ["it", "it"],
  ["ja", "jp"],
  ["km", "kh"],
  ["ky", "kg"],
  ["ml", "in"],
  ["ru", "ru"],
  ["si", "lk"],
  ["sr", "rs"],
  ["ta", "in"],
  ["te", "in"],
  ["th", "th"],
  ["tl", "ph"],
  ["tr", "tr"],
  ["uz", "uz"],
  ["vi", "vn"],
  ["zh", "cn"],
  ["ur", "pk"],
  ["de", "de"],
]);

const NATIVE_NAMES = new Map<string, string>([
  ["as", "অসমীয়া"],
  ["ff", "Fulfulde"],
  ["km", "ខ្មែរ"],
  ["ku", "کوردی"],
  ["ky", "Кыргызча"],
  ["ps", "پښتو"],
  ["si", "සිංහල"],
  ["ug", "ئۇيغۇرچە"],
]);

export const flagOf = (language: string) => FLAGS.get(language);

export const useTafsirLanguage = create<{
  chosen?: TafsirLanguage;
  choose: (language: TafsirLanguage) => void;
}>()((set) => ({
  choose: (language) => {
    globalThis.localStorage?.setItem(STORAGE_KEY, language);
    set({ chosen: language });
  },
}));

export const pickTafsirLanguage = (
  available: TafsirLanguage[],
  chosen?: TafsirLanguage,
) =>
  [
    chosen,
    globalThis.localStorage?.getItem(STORAGE_KEY),
    ...(globalThis.navigator?.languages ?? []).map((tag) => tag.split("-")[0]),
  ].flatMap((code) => available.filter((language) => language === code))[0] ??
  "en";

export const preferredLanguage = (chosen?: TafsirLanguage) =>
  chosen ??
  globalThis.localStorage?.getItem(STORAGE_KEY) ??
  globalThis.navigator?.languages?.[0]?.split("-")[0] ??
  "en";

export const byEnglishName = (languages: TafsirLanguage[]) =>
  languages.toSorted((a, b) =>
    (englishNames.of(a) ?? a).localeCompare(englishNames.of(b) ?? b),
  );

export const nativeName = (language: string) => {
  const name =
    NATIVE_NAMES.get(language) ??
    new Intl.DisplayNames([language], { type: "language" }).of(language) ??
    language;
  return `${name.charAt(0).toLocaleUpperCase(language)}${name.slice(1)}`;
};
