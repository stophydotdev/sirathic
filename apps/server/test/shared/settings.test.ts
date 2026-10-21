import { expect, test } from "bun:test";
import { rememberedUpdate } from "../../src/shared/settings";

const nothing = {
  madhab: null,
  answerLanguage: null,
  answerLength: null,
  showArabic: null,
  fact: null,
};

test("only the preferences the user stated change", () => {
  expect(
    rememberedUpdate([], { ...nothing, madhab: "hanafi", showArabic: false }),
  ).toEqual({ madhab: "hanafi", showArabic: false });
});

test.each([
  [
    ["is a revert"],
    "studies in the UK",
    { memory: ["is a revert", "studies in the UK"] },
  ],
  [["is a revert"], "is a revert", {}],
  [
    Array.from({ length: 20 }, (_, i) => `fact ${i}`),
    "fact 20",
    { memory: Array.from({ length: 20 }, (_, i) => `fact ${i + 1}`) },
  ],
])("memory %p plus %p saves %p", (memory, fact, expected) => {
  expect(rememberedUpdate(memory, { ...nothing, fact })).toEqual(expected);
});
