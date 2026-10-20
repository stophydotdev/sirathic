import { expect, test } from "bun:test";
import { DEFAULT_SETTINGS } from "../../src/shared/settings";
import { answerRules, type Rule } from "../../src/chat/prompt";

const SITUATIONAL = [
  "<copyright_restrictions>",
  "<mathematical_expressions>",
  "<rewrites>",
  "<followup>",
];

test.each([
  ["what is tawakkul", []],
  ["zakat on gold nisab", ["<mathematical_expressions>"]],
  ["lyrics of tala al badru", ["<copyright_restrictions>"]],
  [
    "write a khutbah on patience",
    ["<copyright_restrictions>", "<rewrites>", "<followup>"],
  ],
])("%s gets the situational rules %p", (question, sections) => {
  const rules = answerRules(DEFAULT_SETTINGS, question, new Set());
  expect(SITUATIONAL.filter((tag) => rules.includes(tag))).toEqual(sections);
});

test("short answers leave out the lesson structure", () => {
  const question = "is a mortgage halal";
  expect(answerRules(DEFAULT_SETTINGS, question, new Set())).toContain(
    "<structure>",
  );
  expect(
    answerRules(
      { ...DEFAULT_SETTINGS, answerLength: "short" },
      question,
      new Set(),
    ),
  ).not.toContain("<structure>");
  expect(
    answerRules(DEFAULT_SETTINGS, question, new Set(["lesson"])),
  ).not.toContain("<structure>");
  expect(
    answerRules(
      { ...DEFAULT_SETTINGS, answerLength: "detailed" },
      question,
      new Set(["lesson"]),
    ),
  ).toContain("<structure>");
});

test.each([
  ["schools", "what is wudu", "When the schools differ"],
  ["scholar", "what is wudu", "a qualified local scholar"],
  ["hadithCheck", "what is wudu", "For a hadith check"],
  ["dua", "what is wudu", "For a dua"],
  ["writing", "write a khutbah on patience", "<rewrites>"],
  ["math", "zakat on 85g of gold", "<mathematical_expressions>"],
] satisfies [Rule, string, string][])(
  "leaving out %s drops its rule",
  (rule, question, marker) => {
    expect(answerRules(DEFAULT_SETTINGS, question, new Set())).toContain(
      marker,
    );
    expect(
      answerRules(DEFAULT_SETTINGS, question, new Set([rule])),
    ).not.toContain(marker);
  },
);
