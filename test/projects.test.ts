import { expect, test } from "bun:test";
import {
  projectRemembered,
  projectRules,
  settingsInProject,
} from "../apps/server/src/projectRules";
import { containsLink } from "../apps/server/src/shared/projects";
import { FILE_CHARS, projectFilesRules, TOTAL_CHARS } from "../apps/server/src/projectFiles";
import { rememberedUpdate } from "../apps/server/src/shared/settings";

test("a project with instructions adds them to the chat rules with its name", () => {
  expect(projectRules({ name: "Fiqh notes", instructions: "Answer in two lines." })).toBe(
    '\n\nThis chat is in the project "Fiqh notes". Follow its instructions:\nAnswer in two lines.',
  );
});

test("a project without instructions, or no project, adds nothing", () => {
  expect(projectRules({ name: "Empty", instructions: "" })).toBe("");
  expect(projectRules(undefined)).toBe("");
});

const told = {
  fact: null,
  madhab: null,
  answerLanguage: null,
  answerLength: null,
  showArabic: null,
};

test("a fact goes to the project memory and a preference stays a setting", () => {
  expect(
    projectRemembered(["Lives in Kigali"], { ...told, fact: "Has two kids", madhab: "shafii" }),
  ).toEqual({
    memory: ["Lives in Kigali", "Has two kids"],
    preferences: { madhab: "shafii" },
  });
});

test("a fact the project already knows is not added twice", () => {
  expect(projectRemembered(["Has two kids"], { ...told, fact: "Has two kids" })).toEqual({
    memory: undefined,
    preferences: {},
  });
});

test("a project-only memory replaces the main memory and the default keeps it", () => {
  const settings = { madhab: "hanafi", memory: ["Lives in Kigali"] };
  const project = { projectOnlyMemory: true, memory: ["Studies fiqh"] };
  expect(settingsInProject(settings, project)).toEqual({
    madhab: "hanafi",
    memory: ["Studies fiqh"],
  });
  expect(settingsInProject(settings, { ...project, projectOnlyMemory: false })).toEqual(settings);
  expect(settingsInProject(settings, undefined)).toEqual(settings);
});

test("a project name with a link is caught and a plain name is not", () => {
  expect(
    ["http://localhost", "www.example.com", "visit example.com", "notes.pdf"].map(containsLink),
  ).toEqual([true, true, true, true]);
  expect(
    ["Fiqh notes", "Ramadan 2026", "Q&A, e.g. salah", "Version 1.2"].map(containsLink),
  ).toEqual([false, false, false, false]);
});

test("each file is wrapped with its name and a long file is cut at its cap", () => {
  const rules = projectFilesRules([
    { name: "short.txt", text: "salam" },
    { name: 'long "one".txt', text: "a".repeat(FILE_CHARS + 5) },
  ]);
  expect(rules).toContain('<project_file name="short.txt">\nsalam\n</project_file>');
  expect(rules).toContain(
    `<project_file name="long 'one'.txt">\n${"a".repeat(FILE_CHARS)}\n[Cut: the file is longer than this.]\n</project_file>`,
  );
});

test("files stop at the total cap and no files add nothing", () => {
  const full = { name: "big.txt", text: "b".repeat(FILE_CHARS) };
  const rules = projectFilesRules([full, full, full, { name: "last.txt", text: "x" }]);
  expect(rules.match(/<project_file /g)?.length).toBe(TOTAL_CHARS / FILE_CHARS);
  expect(rules).not.toContain("last.txt");
  expect(projectFilesRules([])).toBe("");
});

const nothing = {
  madhab: null,
  answerLanguage: null,
  answerLength: null,
  showArabic: null,
  fact: null,
};

test("only the preferences the user stated change", () => {
  expect(rememberedUpdate([], { ...nothing, madhab: "hanafi", showArabic: false })).toEqual({
    madhab: "hanafi",
    showArabic: false,
  });
});

test.each([
  [["is a revert"], "studies in the UK", { memory: ["is a revert", "studies in the UK"] }],
  [["is a revert"], "is a revert", {}],
  [
    Array.from({ length: 20 }, (_, i) => `fact ${i}`),
    "fact 20",
    { memory: Array.from({ length: 20 }, (_, i) => `fact ${i + 1}`) },
  ],
])("memory %p plus %p saves %p", (memory, fact, expected) => {
  expect(rememberedUpdate(memory, { ...nothing, fact })).toEqual(expected);
});
