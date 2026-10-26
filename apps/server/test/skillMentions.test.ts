import { expect, test } from "bun:test";
import { mentionedSkills } from "../src/skillMentions";

const skills = [{ name: "Brief" }, { name: "Deep" }, { name: "Deep Dive" }, { name: "İman" }];
const namesIn = (text: string) => mentionedSkills(text, skills).map((skill) => skill.name);

test("a skill is found anywhere in the text, in any case", () => {
  expect(namesIn("what is wudu? @brief")).toEqual(["Brief"]);
});

test("the longest name wins and names may contain spaces", () => {
  expect(namesIn("@Deep Dive on salah")).toEqual(["Deep Dive"]);
  expect(namesIn("@Deep on salah")).toEqual(["Deep"]);
});

test("several skills are found once each", () => {
  expect(namesIn("@Brief then @Deep, and @brief again")).toEqual(["Brief", "Deep"]);
});

test("emails and longer words are not skill calls", () => {
  expect(namesIn("write to me@brief.com")).toEqual([]);
  expect(namesIn("@Briefly please")).toEqual([]);
});

test("a name whose lowercase form is longer is still found", () => {
  expect(namesIn("@İman nedir?")).toEqual(["İman"]);
});
