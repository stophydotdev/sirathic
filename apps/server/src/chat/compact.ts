import { arabicTokens } from "@sirathic/core/search/arabic";
import type { duaSearch } from "@sirathic/core/tools/duaSearch";

const VOWEL_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/gu;

const unvowel = (text: string) => text.replaceAll(VOWEL_MARKS, "");

const LINE_START_DASH = /(?<=\n)[ \t]*\u2014[ \t]*/gu;
const EM_DASH = /\s*\u2014\s*/gu;

export const withoutEmDashes = (text: string) =>
  text.replace(LINE_START_DASH, "").replace(EM_DASH, ", ");

const cut = (text: string, chars: number) =>
  text.length > chars ? `${text.slice(0, chars)}…` : text;

const TARGET = String.raw`\((?:[^()\s]|\([^()\s]*\))*(?:\s+"[^"]*")?\)`;
const IMAGE = new RegExp(String.raw`!\[(?:\\.|[^\]\\])*\]` + TARGET, "gu");
const LINK = new RegExp(String.raw`\[((?:\\.|[^\]\\])*)\]` + TARGET, "gu");
const FOOTNOTE = /\\?\[\d{1,3}\\?\]/gu;
const TAG = /<[^>\n]+>/gu;
const MARKERS = /^[\s#>*\-•\d.]+/u;
const LETTER = /\p{L}/u;
const WORDS = /[\p{L}\p{N}]/u;
const BUTTONS = new Set([
  "share",
  "print",
  "cite",
  "copy citation",
  "feedback",
  "search",
  "listen",
  "download",
  "embed",
  "transcript",
  "enlarge this image",
  "toggle more options",
  "see all related content",
  "advertisement",
  "skip to content",
  "menu",
]);

const readable = (line: string) =>
  line
    .replaceAll(IMAGE, "")
    .replaceAll(LINK, "$1")
    .replaceAll(FOOTNOTE, "")
    .replaceAll(TAG, "")
    .replaceAll(/`\s*`/gu, "")
    .replaceAll("****", " ")
    .replaceAll("**", "")
    .trimEnd();

export const pageText = (markdown: string, chars: number) => {
  const seen = new Set<string>();
  const lines = markdown.split("\n").flatMap((line) => {
    if (line.trim() === "") return [""];
    const outsideLinks = line.replaceAll(IMAGE, "").replaceAll(LINK, "");
    if (!LETTER.test(outsideLinks) && !line.startsWith("|")) return [];
    const text = readable(line);
    const key = text.replace(MARKERS, "").trim().toLowerCase();
    if (!WORDS.test(text) || BUTTONS.has(key) || seen.has(key)) return [];
    seen.add(key);
    return [text];
  });
  return cut(
    lines
      .join("\n")
      .replaceAll(/\n{3,}/gu, "\n\n")
      .trim(),
    chars,
  );
};

const LINKED = new RegExp(
  String.raw`\[((?:\\.|[^\]\\])*)\]\(((?:[^()\s]|\([^()\s]*\))*)(?:\s+"[^"]*")?\)`,
  "gu",
);
const DOCUMENT = /\bpdf\b/iu;

export const documentLinks = (markdown: string) => {
  const links = new Map(
    [...markdown.matchAll(LINKED)]
      .filter(([, text = "", url = ""]) => DOCUMENT.test(text) || DOCUMENT.test(url))
      .map(([, text = "", url = ""]) => [url, readable(text)]),
  );
  return links.size === 0
    ? ""
    : ["Linked documents:", ...[...links].map(([url, text]) => `- ${text}: ${url}`)].join("\n");
};

const PIECE_CHARS = 400;
const SENTENCE_END = /(?<=[.!?؟؛])\s+/u;
const ARABIC_PREFIX = /^(?:[وفبكل]?ال|[وف])(?=\p{L}{3})/u;
const LATIN_PLURAL = /(?<=\p{Script=Latin}{3})s$/u;
const K1 = 1.5;
const B = 0.75;

const termsOf = (text: string) =>
  arabicTokens(text.toLowerCase()).map((word) =>
    word.replace(ARABIC_PREFIX, "").replace(LATIN_PLURAL, ""),
  );

const piecesOf = (text: string) =>
  text
    .split("\n")
    .flatMap((line) => (line.length <= PIECE_CHARS ? [line] : line.split(SENTENCE_END)))
    .reduce<string[]>((pieces, part) => {
      const last = pieces.at(-1);
      if (last !== undefined && last.length + part.length < PIECE_CHARS) {
        pieces[pieces.length - 1] = `${last}\n${part}`;
      } else {
        pieces.push(part);
      }
      return pieces;
    }, []);

const bm25 = (pieces: string[][], query: ReadonlySet<string>) => {
  const average = pieces.reduce((sum, terms) => sum + terms.length, 0) / pieces.length;
  const containing = new Map(
    [...query].map((term) => [term, pieces.filter((terms) => terms.includes(term)).length]),
  );
  return pieces.map((terms) =>
    [...query].reduce((score, term) => {
      const frequency = terms.filter((word) => word === term).length;
      const found = containing.get(term) ?? 0;
      if (frequency === 0) return score;
      const rarity = Math.log(1 + (pieces.length - found + 0.5) / (found + 0.5));
      const length = 1 - B + (B * terms.length) / average;
      return score + (rarity * frequency * (K1 + 1)) / (frequency + K1 * length);
    }, 0),
  );
};

export const bestPieces = (text: string, queries: readonly string[], chars: number) => {
  if (text.length <= chars) return text;
  const pieces = piecesOf(text);
  const scores = bm25(pieces.map(termsOf), new Set(queries.flatMap(termsOf)));
  if (!scores.some((score) => score > 0)) return cut(text, chars);
  const byScore = pieces
    .map((_, index) => index)
    .toSorted((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
  const kept = new Set<number>();
  let used = 0;
  for (const index of byScore) {
    const size = (pieces[index]?.length ?? 0) + 1;
    if (kept.has(index) || used + size > chars) continue;
    kept.add(index);
    used += size;
  }
  if (kept.size === 0) return cut(text, chars);
  return pieces
    .flatMap((piece, index) =>
      kept.has(index) ? [index > 0 && !kept.has(index - 1) ? `…${piece}` : piece] : [],
    )
    .join("\n");
};

const cited = (citation: number | null, line: string) =>
  citation === null ? line : `[${citation}] ${line}`;

const block = (title: string, entries: string[]) =>
  entries.length > 0 ? [`## ${title}`, ...entries].join("\n") : "";

type Verse = {
  citation: number | null;
  ref: string;
  english: string;
  tafsir: string | null;
};

export const quranBlock = (verses: Verse[]) =>
  block(
    "quran",
    verses.map((verse) =>
      [cited(verse.citation, verse.ref), verse.english, verse.tafsir && `Tafsir: ${verse.tafsir}`]
        .filter((line) => line)
        .join("\n"),
    ),
  );

type Hadith = {
  citation: number | null;
  ref: string;
  english: string | null;
  arabic: string | null;
  grade: string | null;
};

export const hadithBlock = (hadiths: Hadith[]) =>
  block(
    "hadith",
    hadiths.map((hadith) =>
      [
        cited(hadith.citation, hadith.grade ? `${hadith.ref} (${hadith.grade})` : hadith.ref),
        hadith.english,
        hadith.arabic && unvowel(hadith.arabic),
      ]
        .filter((line) => line)
        .join("\n"),
    ),
  );

type Passage = {
  citation: number | null;
  work: string;
  author: string;
  school: string;
  volume: number | null;
  page: number | null;
  heading: string | null;
  text: string | null;
};

export const fiqhBlock = (passages: Passage[]) =>
  block(
    "fiqh",
    passages.map((passage) =>
      [
        cited(
          passage.citation,
          `${passage.work}, ${passage.author} (${passage.school}), vol ${passage.volume} p ${passage.page}${passage.heading ? `: ${passage.heading}` : ""}`,
        ),
        passage.text && unvowel(passage.text),
      ]
        .filter((line) => line)
        .join("\n"),
    ),
  );

type Dua = Awaited<ReturnType<typeof duaSearch>>["duas"][number];

export const duaBlock = (duas: Dua[]) =>
  block(
    "duas",
    duas.map((dua) =>
      [
        cited(null, dua.grade ? `${dua.title} (${dua.grade})` : dua.title),
        dua.textAr,
        dua.textEn,
        dua.explanation,
        dua.attribution && `Source: ${dua.attribution}`,
        dua.hadithId && `Hadith: ${dua.hadithId}`,
      ]
        .filter((line) => line)
        .join("\n"),
    ),
  );

type Page = {
  citation: number | null;
  title: string;
  site: string;
  date: string | null;
  text: string;
};

export const pagesBlock = (title: string, pages: Page[]) =>
  block(
    title,
    pages.map((page) =>
      [
        cited(
          page.citation,
          `${page.title} (${page.date ? `${page.site}, ${page.date}` : page.site})`,
        ),
        page.text,
      ].join("\n"),
    ),
  );
