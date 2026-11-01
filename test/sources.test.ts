import { expect, spyOn, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  hadithIdOfSunnahUrl,
  hadithLink,
  OUR_LETTERED,
} from "../packages/core/src/tools/hadithLinks";
import { quranTranslation } from "../packages/core/src/tools/quranTranslation";
import { verseSource } from "../apps/server/src/chat/cite";
import { trustedHadith } from "../packages/core/src/tools/trustedHadith";
import { hadithKey } from "../scripts/hadithKey";

test("hadith links follow each collection's own page numbering", () => {
  expect([
    hadithLink("malik:1074", null),
    hadithLink("muslim:1907a", null),
    hadithLink("bukhari:402.2", null),
    hadithLink("ahmad:781", "https://ar.wikisource.org/wiki/chapter"),
    hadithLink("dehlawi:33", null),
    hadithLink("bukhari:1132.2", null),
    hadithLink("tirmidhi:3604.1", null),
    hadithLink("nasai:125b", "https://sunnah.com/nasai:125b"),
  ]).toEqual([
    "https://sunnah.com/urn/510770",
    "https://sunnah.com/muslim:1907a",
    "https://sunnah.com/bukhari:402b",
    "https://ar.wikisource.org/wiki/chapter#781",
    "https://sunnah.com/shahwaliullah40:33",
    "https://sunnah.com/bukhari:1132b",
    "https://sunnah.com/tirmidhi:3604j",
    "https://sunnah.com/urn/1101260",
  ]);
  expect(hadithIdOfSunnahUrl("https://sunnah.com/tirmidhi:3604j")).toBe("tirmidhi:3604.1");
  expect(hadithIdOfSunnahUrl("https://sunnah.com/urn/1101260")).toBe("nasai:125b");
  expect(OUR_LETTERED.get("bukhari:1132b")).toBe("bukhari:1132.2");
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

test("a verse in French comes from its published translation, without footnote marks, credited", async () => {
  const listed = {
    data: [
      {
        key: "french_rashid",
        language: "fr",
        title: "French Translation - Rachid Maach",
        version: "1.0.3",
      },
    ],
  };
  const openData = spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json(listed))
    .mockResolvedValueOnce(
      Response.json({
        data: {
          verses: [{ ayah: 2, translation: "Louange à Allah, Seigneur de la Création[2]," }],
        },
      }),
    )
    .mockResolvedValueOnce(Response.json(listed));
  try {
    const french = await quranTranslation("fr", 1);
    expect(french?.verses.get(2)).toBe("Louange à Allah, Seigneur de la Création,");
    expect(french?.by).toBe("French Translation - Rachid Maach, version 1.0.3, from QuranEnc.com");
    expect(String(openData.mock.calls[1]?.[0])).toBe(
      "https://api.sirathic.com/v1/quran/translations/french_rashid/1",
    );
    await expect(quranTranslation("xx", 1)).rejects.toThrow("none published");
  } finally {
    openData.mockRestore();
  }
});

test("a verse's source preview leaves out the translation's footnote marks", () => {
  const verse = {
    id: "quran:13:1",
    surah: 13,
    surahName: "Ar-Ra'd",
    ayah: 1,
    textAr: "المر",
    textEn: "Alif, Lām, Meem, Rā.[622] These are the verses of the Book[623]",
    footnotesEn: null,
    tafsirAr: null,
  };
  expect(verseSource(verse).snippet).toBe("Alif, Lām, Meem, Rā. These are the verses of the Book");
});
