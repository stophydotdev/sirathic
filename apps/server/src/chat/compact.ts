const VOWEL_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/gu;

export const unvowel = (text: string) => text.replaceAll(VOWEL_MARKS, "");

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

const cited = (citation: number | null, line: string) =>
  citation === null ? line : `[${citation}] ${line}`;

const block = (title: string, entries: string[]) =>
  entries.length > 0 ? [`## ${title}`, ...entries].join("\n") : "";

type Verse = {
  citation: number | null;
  ref: string;
  arabic: string;
  english: string;
  tafsir: string | null;
};

export const quranBlock = (verses: Verse[]) =>
  block(
    "quran",
    verses.map((verse) =>
      [
        cited(verse.citation, verse.ref),
        verse.arabic,
        verse.english,
        verse.tafsir && `Tafsir: ${verse.tafsir}`,
      ]
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
        cited(
          hadith.citation,
          hadith.grade ? `${hadith.ref} (${hadith.grade})` : hadith.ref,
        ),
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
