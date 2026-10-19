import { expect, test } from "bun:test";
import { onePerAnswer } from "@sirathic/core/search/onePerAnswer";

test("a page and every translation of an islamqa.info answer count once, best rank first", () => {
  const ranked = [
    {
      id: "islamqa.info:fr:13729",
      url: "https://islamqa.info/fr/answers/13729",
    },
    { id: "islamqa.info:13729", url: "https://islamqa.info/en/answers/13729" },
    {
      id: "islamqa.org:8380",
      url: "https://islamqa.org/hanafi/daruliftaa/8380/",
    },
    {
      id: "islamqa.org:8380#2",
      url: "https://islamqa.org/hanafi/daruliftaa/8380/",
    },
    {
      id: "islamqa.info:ar:13729#2",
      url: "https://islamqa.info/ar/answers/13729",
    },
    {
      id: "islamqa.info:426916",
      url: "https://islamqa.info/en/answers/426916",
    },
  ];
  expect(onePerAnswer(ranked).map((row) => row.id)).toEqual([
    "islamqa.info:fr:13729",
    "islamqa.org:8380",
    "islamqa.info:426916",
  ]);
});
