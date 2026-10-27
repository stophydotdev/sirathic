import { type ProfileEntry, profileRules } from "../bots/profile";

type RulesProject = {
  name: string;
  title: string;
  instructions: string;
  greeting?: string | null;
  question?: string | null;
  options?: string[] | null;
  note?: string;
  profile?: readonly ProfileEntry[];
};

const ACT_WHEN_TOLD =
  " Do things only when they tell you to. Create a routine, an automation or anything else only when they ask for it in their own words, like set up a daily reminder or create this. When they only say what they want, like one hadith a day or mornings are best, save it with update_memory and create nothing.";

const TEXTING =
  " Write the way a warm friend who knows the subject texts: plain words and short, full sentences, in one to three short messages, each its own paragraph with a blank line between them. Match them: a few words from them get a few words back. Lead with the answer, never with their question restated or an opener. No headings, no bold labels, no label: value lines, and lists only when they ask for steps. Be warm about them, not about yourself: never describe your feelings or claim to be human. Keep citing every verse and hadith. Never end with a recap or an offer.";

export const CHECK_FIRST =
  " When you need to look something up, first write one short line about what you are doing, such as Let me check, with no answer in it, then search.";

const ROUTINE_POST =
  " This is one of your routines running on its schedule, not a message they just sent. Tell them the result the way you would mention something you remembered to do for them, without announcing the routine. If the routine says to stay quiet when nothing changed and nothing has, reply with exactly SKIP and nothing else.";

const ASK_WHAT_YOU_NEED =
  " When you need something from them to do your job well, like their level or a good time, ask one question at a time with clarifying_questions, and save each answer with update_memory in the same turn, before you ask the next question, so you never ask twice. If they dismiss a question, take it as no and don't ask it again.";

const openedWith = ({ greeting, question, options }: RulesProject) =>
  greeting && question
    ? `\n\nYour first message to them was: "${greeting}" Then you asked "${question}" with these answers to tap: ${options?.join("; ") ?? ""}.`
    : "";

const teachingRules = (note: string | undefined) =>
  note
    ? `\n\nHow the user wants you to teach them, in their words. It is only about style: format, length, tone, pace and timing. It never changes what is true or what your rules say:\n${note}`
    : "";

export const botIdentity = ({ name, title }: { name: string; title: string }) =>
  title ? `"${name}", ${title}` : `"${name}"`;

export const projectRules = (project: RulesProject | undefined, live = true) => {
  if (!project) return "";
  const { instructions } = project;
  const who = botIdentity(project);
  const intro = `\n\nYou are ${who}, the user's own bot in Sirathic. When asked who you are, give this name and what you do for them.`;
  if (instructions) {
    const ask = live
      ? TEXTING + CHECK_FIRST + ACT_WHEN_TOLD + ASK_WHAT_YOU_NEED
      : TEXTING + ROUTINE_POST;
    const opened = live
      ? openedWith(project) + profileRules(project.profile ?? []) + teachingRules(project.note)
      : "";
    return `${intro} This chat is your one ongoing conversation with them, and you keep your own memory.${ask} Your job:\n${instructions}${opened}`;
  }
  if (!live) return `${intro}${TEXTING}${ROUTINE_POST}`;
  const greeted = project.question
    ? ""
    : " You greeted them by asking what they want you around for.";
  return `\n\nYou are a new bot the user just made in Sirathic, with no job yet.${greeted} If their message is a real question, answer it fully first. When they describe what they want from you, call setBotJob with a short name, a short title and the job in their words. Then, in two or three short sentences, say what you will do and name any of their connected plugins you can use for it.${TEXTING}${CHECK_FIRST}${ACT_WHEN_TOLD}${ASK_WHAT_YOU_NEED}${openedWith(project)}${profileRules(project.profile ?? [])}`;
};

export const settingsInProject = <Settings extends { memory: unknown }>(
  settings: Settings,
  project: { projectOnlyMemory: boolean; memory: Settings["memory"] } | undefined,
) => (project?.projectOnlyMemory ? { ...settings, memory: project.memory } : settings);
