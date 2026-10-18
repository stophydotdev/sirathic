import { expect, test } from "bun:test";
import { hadithLink } from "@sirathic/core/tools/hadithLinks";

test("hadiths that share a chapter page get their own link", () => {
  const page = "https://ar.wikisource.org/wiki/chapter";
  expect(hadithLink("ahmad:781", page)).toBe(`${page}#781`);
  expect(hadithLink("ahmad:782", page)).not.toBe(hadithLink("ahmad:781", page));
});

test("Muwatta Malik links to the hadith's own page on sunnah.com", () => {
  expect(hadithLink("malik:1074", null)).toBe("https://sunnah.com/urn/510770");
});

test("the six books keep their sunnah.com links", () => {
  expect(hadithLink("muslim:1907a", null)).toBe(
    "https://sunnah.com/muslim:1907a",
  );
});

test("an extra chain numbered like 402.2 links to its hadith's page", () => {
  expect(hadithLink("bukhari:402.2", null)).toBe(
    "https://sunnah.com/bukhari:402",
  );
});

test("Riyad as-Salihin links to sunnah.com in its standard numbering", () => {
  expect(hadithLink("riyadussalihin:1", null)).toBe(
    "https://sunnah.com/riyadussalihin:1",
  );
});
