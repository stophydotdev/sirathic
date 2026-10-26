import { expect, test } from "bun:test";
import type { Mode } from "../../../src/shared/messages";
import { DEFAULT_SETTINGS } from "../../../src/shared/settings";
import { answerRules, searchPrompt } from "../../../src/chat/prompts/shared";

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
  const rules = answerRules(DEFAULT_SETTINGS, question, "quick");
  expect(SITUATIONAL.filter((tag) => rules.includes(tag))).toEqual(sections);
});

test("short answers leave out the lesson structure", () => {
  const question = "is a mortgage halal";
  expect(answerRules(DEFAULT_SETTINGS, question, "quick")).toContain("<structure>");
  expect(
    answerRules({ ...DEFAULT_SETTINGS, answerLength: "short" }, question, "quick"),
  ).not.toContain("<structure>");
});

test.each<[Mode, string, string]>([
  ["quick", "one round of parallel searches", "250 to 400 words"],
  ["research", "search again for those", "600 to 900 words"],
])("%s mode gets its own search guidance and length", (mode, search, length) => {
  expect(searchPrompt(new Date(0), mode, "Noor 1 Flash", DEFAULT_SETTINGS)).toContain(search);
  expect(answerRules(DEFAULT_SETTINGS, "is a mortgage halal", mode)).toContain(length);
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
