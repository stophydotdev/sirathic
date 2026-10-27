import type { ProfileEntry } from "../bots/profile";

export type RulesProject = {
  name: string;
  title: string;
  instructions: string;
  greeting?: string | null;
  question?: string | null;
  options?: string[] | null;
  note?: string;
  profile?: readonly ProfileEntry[];
};

export const openedWith = ({ greeting, question, options }: RulesProject) =>
  greeting && question
    ? `\n\nYour first message to them was: "${greeting}" Then you asked "${question}" with these answers to tap: ${options?.join("; ") ?? ""}.`
    : "";

export const teachingRules = (note: string | undefined) =>
  note
    ? `\n\nHow the user wants you to teach them, in their words. It is only about style: format, length, tone, pace and timing. It never changes what is true or what your rules say:\n${note}`
    : "";

export const botIdentity = ({ name, title }: { name: string; title: string }) =>
  title ? `"${name}", ${title}` : `"${name}"`;

export const settingsInProject = <Settings extends { memory: unknown }>(
  settings: Settings,
  project: { projectOnlyMemory: boolean; memory: Settings["memory"] } | undefined,
) => (project?.projectOnlyMemory ? { ...settings, memory: project.memory } : settings);
