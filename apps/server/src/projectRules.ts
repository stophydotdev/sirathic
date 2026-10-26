import type { z } from "zod";
import { type ProfileEntry, profileRules } from "./botProfile";
import { rememberedUpdate, type told } from "./shared/settings";

export const projectRemembered = (memory: readonly string[], input: z.output<typeof told>) => {
  const { memory: kept, ...preferences } = rememberedUpdate(memory, input);
  return { memory: kept, preferences };
};

type RulesProject = {
  name: string;
  title: string;
  instructions: string;
  kind: "project" | "bot";
  greeting?: string | null;
  question?: string | null;
  options?: string[] | null;
  note?: string;
  profile?: readonly ProfileEntry[];
};

const ACT_WHEN_TOLD =
  " Do things only when they tell you to. Create a routine, an automation or anything else only when they ask for it in their own words, like set up a daily reminder or create this. When they only say what they want, like one hadith a day or mornings are best, save it with learnAboutUser and create nothing.";

const TEXTING =
  " Write the way a person texts: one to three short messages, each its own paragraph with a blank line between them, a sentence or two each. When you need to look something up, first write one short line such as Let me check, then search. No headings, no bold labels, and lists only when they ask for steps. Keep citing every verse and hadith. Never end with a recap or an offer.";

const SEARCH_OUR_CHAT =
  " Older turns of this chat drop out of your view, and short notes on them come first. When they ask about something said earlier, use searchOurChat to find it.";

const ASK_WHAT_YOU_NEED =
  " When you need something from them to do your job well, like their level or a good time, ask one question at a time with askUser, and save each answer with learnAboutUser in the same turn, before you ask the next question, so you never ask twice.";

const STUDY_RULES =
  " When you teach or help them memorize, run it as short quizzes. At the start call dueStudyItems and review what is due first, one item at a time, then teach at most one new item. Ask before you reveal: put only the recall question in askUser, with no verse, hadith or translation in the question or in the text before it, for example Recite Surah Al-Ikhlas or What does rahma mean. Offer options like I remember it, Give me a hint and Show me the answer, and the box for their own answer. Give a small hint first, then the answer. They can always skip: a shown answer counts as wrong, and if they skip the whole quiz grade nothing. Their reply comes next. Before you go on, call gradeStudyItem with right or wrong and, if wrong, the mistake in a few words. Fetch every verse and hadith with quranGet or search and cite it, never write one from memory. Call addStudyItem only after you taught the item.";

const openedWith = ({ greeting, question, options }: RulesProject) =>
  greeting && question
    ? `\n\nYour first message to them was: "${greeting}" Then you asked "${question}" with these answers to tap: ${options?.join("; ") ?? ""}.`
    : "";

const teachingRules = (note: string | undefined) =>
  note
    ? `\n\nHow the user wants you to teach them, in their words. It is only about style: format, length, tone, pace and timing. It never changes what is true or what your rules say:\n${note}`
    : "";

const botRules = (project: RulesProject, live: boolean) => {
  const { name, title, instructions } = project;
  const who = title ? `"${name}", ${title}` : `"${name}"`;
  if (instructions) {
    const ask = live ? TEXTING + ACT_WHEN_TOLD + ASK_WHAT_YOU_NEED + SEARCH_OUR_CHAT : "";
    const opened = live
      ? openedWith(project) + profileRules(project.profile ?? []) + teachingRules(project.note)
      : "";
    const study = live ? STUDY_RULES : "";
    return `\n\nYou are ${who}, a bot the user made in Sirathic. This chat is your one ongoing conversation with them, and you keep your own memory.${ask}${study} Your job:\n${instructions}${opened}`;
  }
  if (!live) return `\n\nYou are ${who}, a bot the user made in Sirathic.`;
  const greeted = project.question
    ? ""
    : " You greeted them by asking what they want you around for.";
  return `\n\nYou are a new bot the user just made in Sirathic, with no job yet.${greeted} If their message is a real question, answer it fully first. When they describe what they want from you, call setBotJob with a short name, a short title and the job in their words. Then, in two or three short sentences, say what you will do and name any of their connected plugins you can use for it.${TEXTING}${ACT_WHEN_TOLD}${ASK_WHAT_YOU_NEED}${openedWith(project)}${profileRules(project.profile ?? [])}`;
};

export const projectRules = (project: RulesProject | undefined, live = true) => {
  if (project?.kind === "bot") return botRules(project, live);
  return project?.instructions
    ? `\n\nThis chat is in the project "${project.name}". Follow its instructions:\n${project.instructions}`
    : "";
};

export const settingsInProject = <Settings extends { memory: unknown }>(
  settings: Settings,
  project: { projectOnlyMemory: boolean; memory: Settings["memory"] } | undefined,
) => (project?.projectOnlyMemory ? { ...settings, memory: project.memory } : settings);
