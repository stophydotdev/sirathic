import { expect, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { hadithLink } from "../packages/core/src/tools/hadithLinks";
import { trustedHadith } from "../packages/core/src/tools/trustedHadith";
import { hadithKey } from "../scripts/hadithKey";

test("hadith links follow each collection's own page numbering", () => {
  expect([
    hadithLink("malik:1074", null),
    hadithLink("muslim:1907a", null),
    hadithLink("bukhari:402.2", null),
    hadithLink("ahmad:781", "https://ar.wikisource.org/wiki/chapter"),
  ]).toEqual([
    "https://sunnah.com/urn/510770",
    "https://sunnah.com/muslim:1907a",
    "https://sunnah.com/bukhari:402",
    "https://ar.wikisource.org/wiki/chapter#781",
  ]);
});

test("a hadith keeps its place only when its words match sunnah.com, spelling aside", () => {
  const sunnah = "حَدَّثَنَا مُسَدَّدٌ عَنْ ابْنِ عُمَرَ قَالَ قَالَ رَسُولُ اللَّهِ صلى الله عليه وسلم لاَ يَحِلُّ لَكُمْ هَذَا الأَمْرُ";
  const key = hadithKey(sunnah);
  expect(
    [
      "حدثنا مسدد عن بن عمر قال قال رسول الله ﷺ لا يحل لكم هذا الامر",
      "حدثنا مسدد عن ابن عمر قال قال رسول الله لا يحل لكم هذا الأمر",
      "حدثنا مسدد عن ابن عمر قال قال رسول الله لايحل لكم هذا الامر",
    ].map((text) => hadithKey(text) === key),
  ).toEqual([true, true, true]);
  expect(
    [
      "حدثنا مسدد عن ابن عمر قال قال رسول الله يحل لكم هذا الامر",
      "حدثنا مسدد عن ابن عمر قال قال رسول الله لا يحرم لكم هذا الامر",
    ].map((text) => hadithKey(text) === key),
  ).toEqual([false, false]);
});

test("hadith searches and lookups exclude whole books and the ids sunnah.com contradicts", () => {
  const { sql, params } = new PgDialect().sqlToQuery(trustedHadith.where);
  expect(/"book" not in \([^)]*\) and [^ ]*"id" not in \(/u.test(sql)).toBe(true);
  expect(params).toEqual(expect.arrayContaining(["ahmad", "nasai:1638", "abudawud:3033"]));
  expect(params).not.toContain("bukhari:1");
});
