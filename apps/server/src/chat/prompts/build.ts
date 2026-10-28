import type { ToolSet } from "ai";
import { profileRules } from "../../bots/profile";
import { botIdentity, openedWith, type RulesProject, teachingRules } from "../../projects/rules";
import type { Mode } from "../../shared/messages";
import type { Settings } from "../../shared/settings";
import type { Skill } from "../skills/builtIn";
import answer from "./answer.md" with { type: "text" };
import bot from "./bot.md" with { type: "text" };
import core from "./core.md" with { type: "text" };
import newBot from "./newBot.md" with { type: "text" };
import quick from "./quick.md" with { type: "text" };
import research from "./research.md" with { type: "text" };
import routine from "./routine.md" with { type: "text" };

const MODES = { quick, research } as const satisfies Record<Mode, string>;

const SCHOOLS = {
  hanafi: "Hanafi",
  maliki: "Maliki",
  shafii: "Shafi'i",
  hanbali: "Hanbali",
} as const;

const LANGUAGES = {
  en: "English",
  ar: "Arabic",
  fr: "French",
  ur: "Urdu",
  id: "Indonesian",
  tr: "Turkish",
} as const;

const LENGTHS = {
  default: "Match the length to the question.",
  short: "The user has specified they want short answers.",
  detailed:
    "The user has specified they want longer answers. Goal: Teach the concept thoroughly. Assume the user wants to understand why and how, not just what.",
} as const;

export const fill = (template: string, slots: Readonly<Record<string, string>>) =>
  template.replace(/\{(\w+)\}/gu, (_slot, name: string) => {
    if (!Object.hasOwn(slots, name)) throw new Error(`prompt slot {${name}} has no value`);
    return slots[name];
  });

const VERSE_QUOTE = `> "For indeed, with hardship will be ease." (Quran 94:5)[4]`;

const quote = (showArabic: boolean) =>
  showArabic
    ? `A verse: the translation, then the reference, in a > quote, without the Arabic. The verse card shows the user its Arabic.

${VERSE_QUOTE}

A hadith: the translation, then the reference, in a > quote. The quote may include the Arabic first:

> إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ
>
> "Actions are only by intentions." (Sahih al-Bukhari 1)[5]`
    : `The translation, then the reference, in a > quote, without the Arabic:

${VERSE_QUOTE}`;

const dateLine = (now: Date, timeZone: string) => {
  const day = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(now);
  const hijri = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(now);
  const year = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone }).format(now));
  return `It is currently ${day} in ${timeZone} (${hijri}). The Hijri date is calculated and turns at Maghrib, so it can differ by a day from local sighting. The year began on Jan 1, ${year}. This means ${year - 1} was last year and next year is ${year + 1}.`;
};

const LIST_STYLE_LINES = {
  lists: "Formatting: the user prefers bulleted lists.",
  default: "",
  paragraphs: "Formatting: the user prefers paragraphs to lists.",
} satisfies Record<Settings["listStyle"], string>;

const background = ({
  name,
  about,
  madhab,
  answerLanguage,
  answerLength,
  listStyle,
  instructions,
  memory,
}: Settings) =>
  [
    name && `Name: ${name}`,
    about && `About the user: ${about}`,
    LIST_STYLE_LINES[listStyle],
    madhab !== "none" &&
      `Madhhab: ${SCHOOLS[madhab]}. ${
        answerLength === "short"
          ? "Give this school's position, and bring in the other schools only when they ask."
          : "Give this school's position first, then note where the other schools differ."
      }`,
    answerLanguage !== "auto" &&
      `Answer language: write every answer in ${LANGUAGES[answerLanguage]}, whatever language the question is in.`,
    instructions &&
      `Instructions from the user: ${instructions}\nFollow them unless they conflict with the guidance on sources, quotes, and citations.`,
    memory.length > 0 &&
      `What the user has told you about themselves:\n${memory.map((fact) => `- ${fact}`).join("\n")}`,
  ].flatMap((line) => (line ? [line] : []));

const personalization = (settings: Settings) => {
  const lines = background(settings);
  return lines.length > 0
    ? `\nThe user's personalization data, their interests, priorities, style, and facts about past conversations that may help with continuity, is provided below inside <user_background> tags. Augment it with search_user_memories, when you have it, wherever it matters, as this is high level data only. Use all this information to improve the quality of your responses and tool usage:\n- Remember the user's stated preferences and apply them consistently when responding or using tools.\n- Maintain continuity with the user's past discussions.\n- Incorporate known facts about the user's interests and background into your responses and tool usage when relevant.\n- Be careful not to contradict or forget this information unless the user explicitly updates or removes it.\n- Do not make up new facts about the user.\n\n<user_background>\n${lines.join("\n")}\n</user_background>`
    : "";
};

const abilitiesOf = ({
  offered,
  skills,
  inBot,
  remembers,
  connectedApps,
}: {
  offered: ToolSet;
  skills: readonly Skill[];
  inBot: boolean;
  remembers: boolean;
  connectedApps: readonly string[];
}) =>
  [
    skills.some(({ name }) => name === "routines") &&
      "Set up routines, which are reminders and answers that arrive on a schedule, and change, pause or delete them.",
    inBot && "Keep study items and quiz them, so they can memorize or review.",
    remembers && "Remember what they tell you about themselves, across chats.",
    "create_text_file" in offered &&
      `Make files they keep in their Library, such as a khutbah draft, a study plan or a table${"create_research_report" in offered ? ", and research reports" : ""}.`,
    "code_execution" in offered &&
      "Do exact calculations, such as zakat, inheritance shares and dates.",
    "search_plugins" in offered &&
      `Find and install plugins that connect other apps. Connected now: ${connectedApps.length > 0 ? connectedApps.join(", ") : "none"}.`,
    "update_skill" in offered && "Save their own skills, ways of working you reuse.",
  ].flatMap((line) => (line ? [`- ${line}`] : []));

const botPrompt = (project: RulesProject, live: boolean) =>
  fill(bot, {
    identity: botIdentity(project),
    job: project.instructions ? `Your job:\n${project.instructions}` : live ? newBot : "",
    opened: live ? openedWith(project) : "",
    profile: profileRules(project.profile ?? []),
    teaching: teachingRules(project.note),
  });

export const instructions = ({
  now,
  timezone,
  mode,
  settings,
  project,
  unattended,
  offered,
  skills,
  remembers,
  connectedApps,
  toolNotes,
}: {
  now: Date;
  timezone: string | undefined;
  mode: Mode;
  settings: Settings;
  project: RulesProject | undefined;
  unattended: boolean;
  offered: ToolSet;
  skills: readonly Skill[];
  remembers: boolean;
  connectedApps: readonly string[];
  toolNotes: readonly string[];
}) => {
  const abilities = abilitiesOf({
    offered,
    skills,
    inBot: project !== undefined,
    remembers,
    connectedApps,
  });
  return fill(core, {
    identity: project ? botIdentity(project) : "Sirathic, an Islamic answering engine",
    abilities: abilities.length > 0 ? abilities.join("\n") : "- None in this run.",
    tool_notes: toolNotes
      .map((note) => note.trim())
      .filter(Boolean)
      .join("\n\n"),
    quote: quote(settings.showArabic),
    length: LENGTHS[settings.answerLength],
    format: project ? "" : answer,
    surface: [project ? botPrompt(project, !unattended) : MODES[mode], unattended && routine]
      .flatMap((part) => (part ? [part] : []))
      .join("\n\n"),
    date: dateLine(now, timezone ?? "UTC"),
    personalization: personalization(settings),
  });
};
