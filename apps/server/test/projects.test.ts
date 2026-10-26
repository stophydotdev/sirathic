import { expect, test } from "bun:test";
import { projectRemembered, projectRules, settingsInProject } from "../src/projectRules";

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
