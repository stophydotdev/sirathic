import { tool } from "ai";
import { z } from "zod";
import type { Mode } from "../../shared/messages";
import research from "./research.md" with { type: "text" };
import routines from "./routines.md" with { type: "text" };
import study from "./study.md" with { type: "text" };
import writing from "./writing.md" with { type: "text" };

export const LOAD_SKILL = "load_skill";

export type Skill = {
  name: string;
  when: string;
  text: string;
  tools?: readonly string[];
};

type Where = {
  mode: Mode;
  texting: boolean;
  inBot: boolean;
  timezone: string | undefined;
};

export const skillsFor = ({ mode, texting, inBot, timezone }: Where) =>
  [
    ...(mode === "research"
      ? [
          {
            name: "research",
            when: "research mode, before any search: how to split the question, search it in rounds and stop",
            text: research,
          },
        ]
      : []),
    ...(texting
      ? []
      : [
          {
            name: "writing",
            when: "the user asks you to write, rewrite, translate or draft something, like a khutbah, a reminder, a letter or an email",
            text: writing,
          },
        ]),
    ...(inBot
      ? [
          {
            name: "study",
            when: "the user wants to be quizzed, to review, or to memorize something",
            text: study,
            tools: ["addStudyItem", "dueStudyItems", "gradeStudyItem"],
          },
        ]
      : []),
    ...(timezone
      ? [
          {
            name: "routines",
            when: "the user asks for a reminder, a routine or a scheduled answer, or to see, change, pause or delete one",
            text: `${routines}\n\nThe user's time zone is ${timezone}.`,
            tools: ["update_routine", "list_routines"],
          },
        ]
      : []),
  ] satisfies Skill[];

export const skillIndex = (skills: readonly Skill[]) =>
  skills.length === 0
    ? ""
    : `\n\n## Skills\n\nA skill holds the detailed instructions for one kind of task. When a task matches a skill below, call ${LOAD_SKILL} with its name first. Its instructions then arrive in these rules and its tools open. Never copy them into your answer.\n\n${skills.map(({ name, when }) => `- ${name}: ${when}`).join("\n")}`;

const loadInput = z.object({
  names: z.array(z.string()).min(1).describe("Names of the skills to load, from your rules."),
});

export const loadSkill = (skills: readonly Skill[]) =>
  tool({
    description:
      "Loads skills from the list in your rules. Their instructions join your rules for the rest of this chat, and the tools they use open. Call it before you start a task a skill covers.",
    inputSchema: loadInput,
    execute: ({ names }) => {
      const missing = names.filter((name) => !skills.some((skill) => skill.name === name));
      return missing.length > 0
        ? `No skill named ${missing.join(", ")}. The skills are ${skills.map((skill) => skill.name).join(", ")}.`
        : `Loaded ${names.join(", ")}.`;
    },
  });

export const loadedNames = (calls: readonly { toolName: string; input: unknown }[]) =>
  calls.flatMap(({ toolName, input }) =>
    toolName === LOAD_SKILL ? (loadInput.safeParse(input).data?.names ?? []) : [],
  );

export const loadedText = (skills: readonly Skill[], loaded: ReadonlySet<string>) =>
  skills
    .filter(({ name }) => loaded.has(name))
    .map(({ name, text }) => `\n\n## Skill: ${name}\n\n${text}`)
    .join("");

export const closedTools = (skills: readonly Skill[], loaded: ReadonlySet<string>) =>
  new Set(skills.filter(({ name }) => !loaded.has(name)).flatMap(({ tools = [] }) => tools));
