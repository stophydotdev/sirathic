import { expect, test } from "bun:test";
import { FILE_CHARS, projectFilesRules, TOTAL_CHARS } from "../src/projectFiles";

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
