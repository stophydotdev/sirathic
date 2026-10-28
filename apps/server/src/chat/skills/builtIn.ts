import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { Mode } from "../../shared/messages";
import { CODE_RULES } from "../codeTools";
import { CONFIRM_RULES, writingTools } from "../confirm";
import { fileRules } from "../fileTools";
import research from "./research.md" with { type: "text" };
import routines from "./routines.md" with { type: "text" };
import skillAuthoring from "./skillAuthoring.md" with { type: "text" };
import study from "./study.md" with { type: "text" };
import writing from "./writing.md" with { type: "text" };

export const LOAD_SKILL = "load_skill";

export type Skill = {
  name: string;
  when: string;
  text: string;
  tools?: readonly string[];
};

export type UserSkill = { name: string; instructions: string };

type Where = {
  mode: Mode;
  texting: boolean;
  inBot: boolean;
  timezone: string | undefined;
  canWriteSkills: boolean;
  userSkills: readonly UserSkill[];
  offered: ToolSet;
  plugins: ToolSet;
};

const WHEN_CHARS = 140;

const PLUGIN_RULES =
  "Find apps with search_plugins and connect one with install_plugin. The tools of the apps the user has connected open with this skill: use them for what the user asks of that app. For a command tool like PostHog's exec, read its help once, then run the query.";

const whenOf = ({ instructions }: UserSkill) =>
  (instructions.split(/(?<=[.!?])\s/u)[0] ?? instructions).slice(0, WHEN_CHARS);

export const skillsFor = ({
  mode,
  texting,
  inBot,
  timezone,
  canWriteSkills,
  userSkills,
  offered,
  plugins,
}: Where): Skill[] => {
  const files = fileRules(offered);
  const builtIn = [
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
    ...(canWriteSkills
      ? [
          {
            name: "skill_authoring",
            when: "the user asks you to save, rewrite or delete a skill, or you notice a task worth saving for reuse",
            text: skillAuthoring,
            tools: ["update_skill"],
          },
        ]
      : []),
    ...("code_execution" in offered
      ? [
          {
            name: "calculate",
            when: "the answer needs exact numbers, like zakat, nisab, inheritance shares, hijri dates or unit conversions",
            text: CODE_RULES,
            tools: ["code_execution"],
          },
        ]
      : []),
    ...(files.tools.length > 0
      ? [
          {
            name: "files",
            when: "the user asks for a file to keep or share, like a khutbah draft, a study plan, a table or a report",
            text: files.text,
            tools: files.tools,
          },
        ]
      : []),
    ...("search_plugins" in offered
      ? [
          {
            name: "plugins",
            when: "the user wants to find or connect an app, or to use one they connected, like their calendar, email, notes or tasks",
            text: [PLUGIN_RULES, writingTools(plugins).length > 0 ? CONFIRM_RULES : ""]
              .filter(Boolean)
              .join("\n\n"),
            tools: ["search_plugins", "install_plugin", ...Object.keys(plugins)],
          },
        ]
      : []),
  ] satisfies Skill[];
  const taken = new Set(builtIn.map(({ name }) => name.toLowerCase()));
  const own = userSkills
    .filter(({ name }) => !taken.has(name.toLowerCase()))
    .map((skill) => ({ name: skill.name, when: whenOf(skill), text: skill.instructions }));
  return [...builtIn, ...own];
};

export const skillIndex = (skills: readonly Skill[]) =>
  skills.map(({ name, when }) => `- ${name}: ${when}`).join("\n");

const loadInput = z.object({
  names: z.array(z.string()).min(1).describe("Names of the skills to load, from your rules."),
});

export const loadSkill = (skills: readonly Skill[]) =>
  tool({
    description:
      "Loads skills from the list in your rules. Their instructions join your rules for the rest of this chat, and their tools open on your next step, so call it on its own first.",
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
