import { expect, test } from "bun:test";
import { withoutStopwords } from "@sirathic/core/search/arabic";
import { onePerAnswer } from "@sirathic/core/search/onePerAnswer";
import { hadithLink } from "@sirathic/core/tools/hadithLinks";

test("keyword queries drop Arabic stopwords and keep every other word as written", () => {
  expect(withoutStopwords("حكم تعجيل الزكاة قبل الحول في المال")).toBe(
    "حكم تعجيل الزكاة قبل الحول المال",
  );
  expect(withoutStopwords("صلاة المسافر على الراحلة")).toBe("صلاة المسافر الراحلة");
  expect(withoutStopwords("Can I pray Fajr after sunrise?")).toBe("Can I pray Fajr after sunrise?");
});

test("a page and every translation of an islamqa.info answer count once, best rank first", () => {
  const ranked = [
    {
      id: "islamqa.info:fr:13729",
      url: "https://islamqa.info/fr/answers/13729",
    },
    { id: "islamqa.info:13729", url: "https://islamqa.info/en/answers/13729" },
    {
      id: "islamqa.org:8380",
      url: "https://islamqa.org/hanafi/daruliftaa/8380/",
    },
    {
      id: "islamqa.org:8380#2",
      url: "https://islamqa.org/hanafi/daruliftaa/8380/",
    },
    {
      id: "islamqa.info:ar:13729#2",
      url: "https://islamqa.info/ar/answers/13729",
    },
    {
      id: "islamqa.info:426916",
      url: "https://islamqa.info/en/answers/426916",
    },
  ];
  expect(onePerAnswer(ranked).map((row) => row.id)).toEqual([
    "islamqa.info:fr:13729",
    "islamqa.org:8380",
    "islamqa.info:426916",
  ]);
});

test("hadiths that share a chapter page get their own link", () => {
  const page = "https://ar.wikisource.org/wiki/chapter";
  expect(hadithLink("ahmad:781", page)).toBe(`${page}#781`);
  expect(hadithLink("ahmad:782", page)).not.toBe(hadithLink("ahmad:781", page));
});

test("Muwatta Malik links to the hadith's own page on sunnah.com", () => {
  expect(hadithLink("malik:1074", null)).toBe("https://sunnah.com/urn/510770");
});

test("the six books keep their sunnah.com links", () => {
  expect(hadithLink("muslim:1907a", null)).toBe("https://sunnah.com/muslim:1907a");
});

test("an extra chain numbered like 402.2 links to its hadith's page", () => {
  expect(hadithLink("bukhari:402.2", null)).toBe("https://sunnah.com/bukhari:402");
});

test("Riyad as-Salihin links to sunnah.com in its standard numbering", () => {
  expect(hadithLink("riyadussalihin:1", null)).toBe("https://sunnah.com/riyadussalihin:1");
});
