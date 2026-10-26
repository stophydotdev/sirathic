import { expect, test } from "bun:test";
import { splitLinks } from "../src/components/linkedText";

test("a link keeps its path and drops the trailing period and question mark", () => {
  expect(splitLinks("What does https://a.org/x/y say? Also see https://b.info/en/82536.")).toEqual([
    { kind: "text", value: "What does " },
    { kind: "link", value: "https://a.org/x/y" },
    { kind: "text", value: " say? Also see " },
    { kind: "link", value: "https://b.info/en/82536" },
    { kind: "text", value: "." },
  ]);
});

test("a link in brackets or quotes loses the closing mark", () => {
  expect(splitLinks('(http://a.org/p), "https://b.org"').map((p) => p.value)).toEqual([
    "(",
    "http://a.org/p",
    '), "',
    "https://b.org",
    '"',
  ]);
});

test("text without a link comes back as one part", () => {
  expect(splitLinks("no links\nhere")).toEqual([{ kind: "text", value: "no links\nhere" }]);
});
