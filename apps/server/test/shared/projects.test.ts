import { expect, test } from "bun:test";
import { containsLink } from "../../src/shared/projects";

test("a project name with a link is caught and a plain name is not", () => {
  expect(
    ["http://localhost", "www.example.com", "visit example.com", "notes.pdf"].map(containsLink),
  ).toEqual([true, true, true, true]);
  expect(
    ["Fiqh notes", "Ramadan 2026", "Q&A, e.g. salah", "Version 1.2"].map(containsLink),
  ).toEqual([false, false, false, false]);
});
