import { expect, test } from "bun:test";
import { namesOfAllah } from "@sirathic/core/tools/namesOfAllah";

const numbersFor = (query: string) => namesOfAllah({ query }).names.map((name) => name.number);

test("the full list has 99 names in the order of the narration", () => {
  const { names } = namesOfAllah({});
  expect(names).toHaveLength(99);
  expect(names[0]?.transliteration).toBe("Allah");
  expect(names[98]?.transliteration).toBe("As-Sabur");
});

test("a name is found from Arabic without vowel marks, a transliteration or a meaning", () => {
  expect(numbersFor("الرحمن")).toEqual([2]);
  expect(numbersFor("ar rahman")).toEqual([2]);
  expect(numbersFor("merciful")).toEqual([2, 3]);
  expect(numbersFor("ذو الجلال والإكرام")).toEqual([85]);
});
