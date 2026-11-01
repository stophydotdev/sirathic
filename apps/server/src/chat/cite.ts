import type { fatwaSearch } from "@sirathic/core/tools/fatwaSearch";
import type { fiqhSearch } from "@sirathic/core/tools/fiqhSearch";
import type { hadithsByIds } from "@sirathic/core/tools/hadithGet";
import { SUNNAH_LETTERED } from "@sirathic/core/tools/hadithLinks";
import type { quranSearch } from "@sirathic/core/tools/quranSearch";
import type { Source } from "../shared/sources";

const SNIPPET_CHARS = 300;
const FOOTNOTE_MARK = /\[\d+\]/gu;

export type Cite = (url: string) => number;
export type Verse = Awaited<ReturnType<typeof quranSearch>>["verses"][number];
type Hadith = Awaited<ReturnType<typeof hadithsByIds>>[number];
type Fatwa = Awaited<ReturnType<typeof fatwaSearch>>["fatwas"][number];
type FiqhPassage = Awaited<ReturnType<typeof fiqhSearch>>["passages"][number];
export type Hit = { url: string; title: string; description: string };

export const verseSource = (verse: Verse): Source => ({
  url: `https://quran.com/${verse.surah}/${verse.ayah}`,
  title: `Quran ${verse.surah}:${verse.ayah}, ${verse.surahName}`,
  snippet: verse.textEn.replaceAll(FOOTNOTE_MARK, "").slice(0, SNIPPET_CHARS),
});

const COLLECTIONS = new Map([
  ["bukhari", "Sahih al-Bukhari"],
  ["muslim", "Sahih Muslim"],
  ["nasai", "Sunan an-Nasa'i"],
  ["abudawud", "Sunan Abi Dawud"],
  ["ibnmajah", "Sunan Ibn Majah"],
  ["tirmidhi", "Jami' at-Tirmidhi"],
  ["malik", "Muwatta Malik"],
  ["ahmad", "Musnad Ahmad"],
  ["darimi", "Sunan ad-Darimi"],
  ["riyadussalihin", "Riyad as-Salihin"],
  ["adab", "Al-Adab al-Mufrad"],
  ["nawawi", "40 Hadith an-Nawawi"],
  ["qudsi", "40 Hadith Qudsi"],
  ["dehlawi", "40 Hadith of Shah Waliullah Dehlawi"],
]);

export const hadithTitle = (hadith: Hadith) => {
  const number =
    hadith.book === "ahmad" && hadith.arabicNumber
      ? hadith.arabicNumber
      : (SUNNAH_LETTERED.get(hadith.id) ?? hadith.id.slice(hadith.id.indexOf(":") + 1));
  const name = `${COLLECTIONS.get(hadith.book) ?? hadith.book} ${number}`;
  return hadith.chapter ? `${name}: ${hadith.chapter}` : name;
};

const MACHINE_TRANSLATION = "Machine translation from the Arabic. Check it before you quote it.";

export const hadithSource = (hadith: Hadith): Source | undefined =>
  hadith.link === null
    ? undefined
    : {
        url: hadith.link,
        title: hadithTitle(hadith),
        snippet: (hadith.english ?? hadith.textAr ?? "").slice(0, SNIPPET_CHARS),
        credit:
          hadith.english !== null && hadith.licensedEnglish === null
            ? [hadith.credit, MACHINE_TRANSLATION].filter((line) => line !== null).join(". ")
            : (hadith.credit ?? undefined),
      };

export const fiqhSource = (passage: FiqhPassage): Source | undefined =>
  passage.url === null
    ? undefined
    : {
        url: passage.url,
        title: `${passage.work}، ${passage.author}، ج${passage.volume} ص${passage.page}`,
        snippet: passage.textAr.slice(0, SNIPPET_CHARS),
      };

export const plainText = (markdown: string) =>
  markdown
    .replaceAll(/!?\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replaceAll(/[#*_`>|]+/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .slice(0, SNIPPET_CHARS);

export const hitSource = (hit: Hit): Source => ({
  url: hit.url,
  title: hit.title,
  snippet: plainText(hit.description),
});

export const fatwaSource = (fatwa: Fatwa): Source => ({
  url: fatwa.url,
  title: fatwa.title,
  snippet: plainText(fatwa.summary ?? fatwa.question ?? fatwa.answer),
});

export function numbered<Item>(
  cite: Cite,
  items: Item[],
  sourceOf: (item: Item) => Source | undefined,
) {
  const sources: Source[] = [];
  const cited = items.map((item) => {
    const found = sourceOf(item);
    if (found === undefined) return { ...item, citation: null };
    sources.push(found);
    return { ...item, citation: cite(found.url) };
  });
  return { cited, sources };
}

export const textBlocked = (url: string) =>
  /(^|\.)sunnah\.com$/u.test(URL.parse(url)?.hostname ?? "");

export const clip = (text: string | null | undefined, chars: number) => {
  const plain = text?.replaceAll(/\s+/gu, " ").trim();
  if (!plain) return null;
  return plain.length > chars ? `${plain.slice(0, chars)}…` : plain;
};

export const gradeOf = (hadith: Hadith) => {
  if (hadith.grades.length > 0) {
    return clip(hadith.grades.map(({ grader, grade }) => `${grade} (${grader})`).join("; "), 140);
  }
  return hadith.book === "bukhari" || hadith.book === "muslim"
    ? `Sahih (${COLLECTIONS.get(hadith.book)})`
    : null;
};
