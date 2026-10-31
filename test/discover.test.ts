import { expect, test } from "bun:test";
import { article } from "../apps/web/src/content/discover/schema";

const cited = "https://sunnah.com/bukhari:513";
const unused = "https://quran.com/5/6";

const verse = { arabic: "ٱلنِّسَآءَ", translation: "women", reference: "5:6", url: unused };

const draft = {
  title: "Does touching a woman break wudu?",
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
