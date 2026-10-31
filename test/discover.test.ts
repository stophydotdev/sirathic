import { expect, test } from "bun:test";
import { parseHadithRef, type HadithRef } from "../apps/data/src/resolve";
import { article } from "../apps/web/src/content/discover/schema";
import { checkCopies, type Check, type Copy } from "../scripts/openData/verify";

const cited = "https://sunnah.com/bukhari:513";
const unused = "https://quran.com/5/6";

const verse = { arabic: "ٱلنِّسَآءَ", translation: "women", reference: "5:6", url: unused };

const draft = {
  title: "Does touching a woman break wudu?",
  headline: "The schools give three answers",
  cover: "اللمس",
  slug: "touching-a-woman-and-wudu",
  topic: "Purification",
  tint: "teal",
  summary: { text: "The schools differ.", citations: [cited] },
  updated: "2026-10-31",
  reviewed: false,
  sources: [{ url: cited, title: "Sahih al-Bukhari 513" }],
  sections: [{ heading: "Hadith", paragraphs: [{ text: "Aisha's feet.", citations: [cited] }] }],
  related: [],
};

test.each([
  [
    "a citation that is not in sources",
    { ...draft, verse, sources: [{ url: unused, title: "Al-Ma'idah 5:6" }] },
    `${cited} is not in sources`,
  ],
  [
    "a source nobody cites",
    { ...draft, sources: [...draft.sources, { url: unused, title: "Al-Ma'idah 5:6" }] },
    `${unused} is never cited`,
  ],
])("an article with %s is rejected", (_name, input, message) => {
  expect(article.safeParse(input).error?.issues.map((issue) => issue.message)).toEqual([message]);
});

test("a source cited only by the verse block counts as cited", () => {
  const input = { ...draft, verse, sources: [...draft.sources, { url: unused, title: "5:6" }] };
  expect(article.safeParse(input).success).toBe(true);
});

const references: [string, HadithRef | null][] = [
  ["muslim 2291a", { kind: "number", collection: "muslim", number: "2291a" }],
  ["Sahih Muslim 2291 a", { kind: "number", collection: "muslim", number: "2291a" }],
  ["Sunan Abi Dawud 1701", { kind: "number", collection: "abudawud", number: "1701" }],
  ["Sunan an-Nasa'i 125b", { kind: "number", collection: "nasai", number: "125b" }],
  ["bukhari, book 1, hadith 1", { kind: "inBook", collection: "bukhari", book: 1, hadith: 1 }],
  ["Quran 2:255", null],
];

test.each(references)("the reference %s resolves to %j", (ref, expected) => {
  expect(parseHadithRef(ref)).toEqual(expected);
});

const intention = { number: "1", arabic: "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى" };

const comparisons: [string, Copy | null, Check][] = [
  [
    "the same Arabic without diacritics and the same number",
    { number: "1", arabic: "انما الاعمال بالنيات وانما لكل امرء ما نوى" },
    { kind: "verified", similarity: 1 },
  ],
  [
    "a second copy that drops half the text",
    { number: "1", arabic: "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ" },
    { kind: "unverified", reason: "arabic_mismatch", similarity: 0.6667 },
  ],
  [
    "the same Arabic under another number",
    { number: "2", arabic: intention.arabic },
    { kind: "unverified", reason: "number_mismatch", similarity: 1 },
  ],
  ["no second copy", null, { kind: "unverified", reason: "no_second_copy", similarity: null }],
];

test.each(comparisons)("a hadith with %s", (_name, second, expected) => {
  expect(checkCopies(intention, second)).toEqual(expected);
});

test("a hadith with no Arabic is never verified, even with a second copy", () => {
  expect(checkCopies({ number: "1", arabic: "" }, intention)).toEqual({
    kind: "unverified",
    reason: "empty_arabic",
    similarity: null,
  });
});
