import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { Mode } from "../../shared/messages";
import { BROWSER_TOOLS } from "../../bots/browser";
import { CODE_RULES } from "../codeTools";
import { CONFIRM_RULES, writingTools } from "../confirm";
import { fileRules } from "../fileTools";
import { STOPHY_LINK } from "../stophyTools";
import { bookingSkills } from "./booking";
import browser from "./browser.md" with { type: "text" };
import chart from "./chart.md" with { type: "text" };
import documentReview from "./documentReview.md" with { type: "text" };
import jobSearch from "./jobSearch.md" with { type: "text" };
import { muslimSkills } from "./muslim";
import noConnector from "./noConnector.md" with { type: "text" };
import onboarding from "./onboarding.md" with { type: "text" };
import pastContext from "./pastContext.md" with { type: "text" };
import peopleSearch from "./peopleSearch.md" with { type: "text" };
import recentChanges from "./recentChanges.md" with { type: "text" };
import research from "./research.md" with { type: "text" };
import restaurants from "./restaurants.md" with { type: "text" };
import routines from "./routines.md" with { type: "text" };
import scheduling from "./scheduling.md" with { type: "text" };
import sendOnBehalf from "./sendOnBehalf.md" with { type: "text" };
import skillAuthoring from "./skillAuthoring.md" with { type: "text" };
import stophy from "./stophy.md" with { type: "text" };
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
  "The tools of the apps the user has connected open with this skill: use them for what the user asks of that app. Never say you don't have access to an app or its data without first calling search_plugins, then connect the app with install_plugin. If no plugin fits, ask the user where the data lives. For a command tool like PostHog's exec, read its help once, then run the query.";

const appTools = (plugins: ToolSet, apps: readonly string[]) =>
  Object.keys(plugins).filter((name) => apps.some((app) => name.startsWith(`${app}_`)));

const APP_SKILLS = new Map([
  ["gmail", ["send_on_behalf"]],
  ["googlecalendar", ["scheduling"]],
]);

export const openedBy = (
  asked: string,
  apps: readonly { id: string; name: string; connected: boolean }[],
) => {
  const named = apps.filter(
    ({ name, connected }) => connected && asked.toLowerCase().includes(name.toLowerCase()),
  );
  return [
    ...(STOPHY_LINK.test(asked) ? ["stophy"] : []),
    ...(named.length > 0
      ? ["plugins", ...named.flatMap(({ id }) => APP_SKILLS.get(id) ?? [])]
      : []),
  ];
};

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
    ...("stophy_call" in offered
      ? [
          {
            name: "stophy",
            when: "Load when the user links a YouTube, TikTok, Instagram, X, Reddit, Amazon, Airbnb, Booking or Google Maps page, or wants live flights, hotels, products and prices, places, reviews, jobs, homes or apps",
            text: stophy,
            tools: ["stophy_search_endpoints", "stophy_call"],
          },
          {
            name: "restaurants",
            when: "Load when the user asks where or what to eat, wants restaurant ideas or a comparison for an occasion, before naming any restaurant",
            text: restaurants,
            tools: ["stophy_search_endpoints", "stophy_call"],
          },
          {
            name: "job_search",
            when: "Load when the user wants job openings, what a company is hiring for, or new postings for a role, before searching any job site",
            text: jobSearch,
            tools: ["stophy_search_endpoints", "stophy_call"],
          },
          {
            name: "people_search",
            when: "Load when the user wants to find people by name, role, company, school, skill or location, like who someone at a company is",
            text: peopleSearch,
            tools: ["stophy_search_endpoints", "stophy_call"],
          },
        ]
      : []),
    ...(mode === "research"
      ? [
          {
            name: "research",
            when: "Research methodology for conducting thorough, multi-round investigations. Defines how to gather context first (memories, then clarifying questions), then gather evidence from authoritative sources in rounds until the question is resolved, cross-validate findings and produce comprehensive answers with inline citations",
            text: research,
          },
        ]
      : []),
    ...(texting
      ? []
      : [
          {
            name: "writing",
            when: "Load when the user asks you to write, rewrite, translate or draft something, like a khutbah, a reminder, a letter or an email",
            text: writing,
          },
          {
            name: "chart",
            when: "Load when the user asks for a chart, graph or diagram, or numbers like inheritance shares, zakat or figures across many items would read better drawn",
            text: chart,
          },
        ]),
    ...(inBot
      ? [
          {
            name: "study",
            when: "Load when the user wants to be quizzed, to review, or to memorize something",
            text: study,
            tools: ["addStudyItem", "dueStudyItems", "gradeStudyItem"],
          },
        ]
      : []),
    ...(timezone
      ? [
          {
            name: "routines",
            when: "Load when the user asks for a reminder, a routine or a scheduled answer, or to see, change, pause or delete one",
            text: `${routines}\n\nThe user's time zone is ${timezone}.`,
            tools: ["update_routine", "list_routines"],
          },
        ]
      : []),
    ...(canWriteSkills
      ? [
          {
            name: "skill_authoring",
            when: "Load when the user asks you to save, rewrite or delete a skill, or you notice a task worth saving for reuse",
            text: skillAuthoring,
            tools: ["update_skill"],
          },
        ]
      : []),
    ...("browser_navigate" in offered
      ? [
          {
            name: "browser",
            when: "Load when a task needs a website you must click, type into or step through, or when search_web or fetch_url fails or is blocked on a public page",
            text: browser,
            tools: BROWSER_TOOLS,
          },
          ...bookingSkills,
        ]
      : []),
    ...("code_execution" in offered
      ? [
          {
            name: "calculate",
            when: "Load when the answer needs exact numbers, like zakat, nisab, inheritance shares, hijri dates or unit conversions",
            text: CODE_RULES,
            tools: ["code_execution"],
          },
        ]
      : []),
    ...(files.tools.length > 0
      ? [
          {
            name: "files",
            when: "Load when the user asks for a file to keep or share, like a khutbah draft, a study plan, a table or a report",
            text: files.text,
            tools: files.tools,
          },
        ]
      : []),
    ...("search_plugins" in offered
      ? [
          {
            name: "plugins",
            when: "Load when the user wants to find or connect an app, or to use one they connected, like their calendar, email, notes or tasks",
            text: [PLUGIN_RULES, !inBot && writingTools(plugins).length > 0 ? CONFIRM_RULES : ""]
              .filter(Boolean)
              .join("\n\n"),
            tools: ["search_plugins", "install_plugin", ...Object.keys(plugins)],
          },
          {
            name: "send_on_behalf",
            when: "Load when the user asks to write, draft, reply to or send an email as them, or to leave a draft in Gmail",
            text: sendOnBehalf,
            tools: ["search_plugins", "install_plugin", ...appTools(plugins, ["gmail"])],
          },
          {
            name: "scheduling",
            when: "Load when the user mentions their calendar, a meeting, availability, a recurring reminder, or coordinating a time with others",
            text: scheduling,
            tools: [
              "search_plugins",
              "install_plugin",
              ...appTools(plugins, ["googlecalendar", "gmail"]),
            ],
          },
          {
            name: "no_plugin_fallback",
            when: "Load when an app or service the user wants has no plugin, a plugin needs sign-in, or you are about to say you cannot reach something",
            text: noConnector,
            tools: ["search_plugins", "install_plugin"],
          },
        ]
      : []),
    ...("search_user_memories" in offered
      ? [
          {
            name: "past_context",
            when: "Load when the user refers to an earlier chat or something they told you, or their saved preferences would improve your answer",
            text: pastContext,
          },
        ]
      : []),
    ...(inBot || texting
      ? []
      : [
          {
            name: "onboarding",
            when: "Load when the first message is a greeting or vague, or the user asks what Sirathic can do or how a feature works",
            text: onboarding,
          },
        ]),
    ...(texting
      ? []
      : [
          {
            name: "document_review",
            when: "Load when the user attaches a document and asks to review, proofread, fact-check or find errors, including its verses and hadith",
            text: documentReview,
          },
          {
            name: "recent_changes",
            when: "Load when the user asks why something about you or the app changed, reports a change you did not make, or asks what is new",
            text: recentChanges,
          },
        ]),
    ...("search_web" in offered ? muslimSkills : []),
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
      "Loads the full instructions of the skills from the list in your rules, before you proceed. Their instructions join your rules for the rest of this chat, and their tools open on your next step. Load every skill that fits the request first, in one call before any other tool.",
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

export const closedTools = (skills: readonly Skill[], loaded: ReadonlySet<string>) => {
  const opened = new Set(
    skills.filter(({ name }) => loaded.has(name)).flatMap(({ tools = [] }) => tools),
  );
  return new Set(
    skills
      .filter(({ name }) => !loaded.has(name))
      .flatMap(({ tools = [] }) => tools)
      .filter((name) => !opened.has(name)),
  );
};
