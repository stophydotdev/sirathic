import { expect, test } from "bun:test";
import { splitMentions } from "../src/components/mentionText";

const targets = [{ name: "Exa" }, { name: "My Skill" }, { name: "My" }];

test("known names after @ become mentions, longest first, as typed", () => {
  expect(splitMentions("ask @my skill and @Exa.", targets)).toEqual([
    { kind: "text", value: "ask " },
    { kind: "mention", value: "@my skill", target: { name: "My Skill" } },
    { kind: "text", value: " and " },
    { kind: "mention", value: "@Exa", target: { name: "Exa" } },
    { kind: "text", value: "." },
  ]);
});

test("emails, longer words and unknown names stay text", () => {
  expect(splitMentions("me@Exa.com @Exam @Other", targets)).toEqual([
    { kind: "text", value: "me@Exa.com @Exam @Other" },
  ]);
});

test("names with a Turkish İ still match, also after one", () => {
  expect(splitMentions("İ @İman", [{ name: "İman" }])).toEqual([
    { kind: "text", value: "İ " },
    { kind: "mention", value: "@İman", target: { name: "İman" } },
  ]);
});
