import { expect, test } from "bun:test";
import { namedReference } from "@sirathic/core/tools/namedReference";

const referenceOf = (name: string): unknown[] =>
  namedReference({ name }).matches.map((match) => ("quran" in match ? match.quran : match.hadith));

test("a well-known name resolves to its reference, however it is spelled", () => {
  expect(referenceOf("Ayat al-Kursi")).toEqual([{ surah: 2, from: 255 }]);
  expect(referenceOf("tell me about the Throne Verse!")).toEqual([{ surah: 2, from: 255 }]);
  expect(referenceOf("آية الكرسي")).toEqual([{ surah: 2, from: 255 }]);
  expect(referenceOf("the last two verses of al-Baqarah")).toEqual([
    { surah: 2, from: 285, to: 286 },
  ]);
  expect(referenceOf("Surah Yasin")).toEqual([{ surah: 36 }]);
  expect(referenceOf("hadith of intentions")).toEqual(["bukhari:1"]);
});

test("a name that is only part of a longer word does not match", () => {
  expect(referenceOf("surah nasr")).toEqual([{ surah: 110 }]);
  expect(referenceOf("what is zakat")).toEqual([]);
});

test("common spellings and wordings resolve too", () => {
  expect(referenceOf("Surah Al-Baqarah")).toEqual([{ surah: 2 }]);
  expect(referenceOf("surah al-fatihah")).toEqual([{ surah: 1 }]);
  expect(referenceOf("Surat al-Ikhlas")).toEqual([{ surah: 112 }]);
  expect(referenceOf("the hadith of intention")).toEqual(["bukhari:1"]);
  expect(referenceOf("the seven whom Allah will shade")).toEqual(["bukhari:660"]);
});

test("a named part of a surah resolves to that part, not the whole surah", () => {
  expect(referenceOf("the first ten verses of Surah al-Kahf")).toEqual([
    { surah: 18, from: 1, to: 10 },
  ]);
  expect(referenceOf("last 10 verses of Kahf")).toEqual([{ surah: 18, from: 101, to: 110 }]);
  expect(referenceOf("the last two verses of Surah al-Baqarah")).toEqual([
    { surah: 2, from: 285, to: 286 },
  ]);
});
