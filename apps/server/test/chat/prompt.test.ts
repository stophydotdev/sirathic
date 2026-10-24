import { expect, test } from "bun:test";
import { DEFAULT_SETTINGS } from "../../src/shared/settings";
import { answerRules, searchPrompt } from "../../src/chat/prompt";

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
  ["write a khutbah on patience", ["<copyright_restrictions>", "<rewrites>", "<followup>"]],
])("%s gets the situational rules %p", (question, sections) => {
  const rules = answerRules(DEFAULT_SETTINGS, question);
  expect(SITUATIONAL.filter((tag) => rules.includes(tag))).toEqual(sections);
});

test("short answers leave out the lesson structure", () => {
  const question = "is a mortgage halal";
  expect(answerRules(DEFAULT_SETTINGS, question)).toContain("<structure>");
  expect(answerRules({ ...DEFAULT_SETTINGS, answerLength: "short" }, question)).not.toContain(
    "<structure>",
  );
});

test("the prompt lists what the user told Sirathic about themselves", () => {
  const prompt = searchPrompt(new Date(0), "quick", "Noor 1 Flash", {
    ...DEFAULT_SETTINGS,
    memory: ["is a revert", "studies in the UK"],
  });
  expect(prompt).toContain(
    "What the user has told you about themselves:\n- is a revert\n- studies in the UK",
  );
});
