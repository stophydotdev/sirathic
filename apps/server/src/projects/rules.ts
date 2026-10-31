import type { ProfileEntry } from "../bots/profile";

export type RulesProject = {
  id: string;
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

export type Teammates = {
  bots: readonly { id: string; name: string; title: string; instructions: string }[];
  groups: readonly { id: string; name: string }[];
};

export const teammateLines = ({ bots, groups }: Teammates) =>
  [
    bots.length > 0
      ? `Teammates you can message right now:\n${bots
          .map(
            ({ id, name, title, instructions }) =>
              `- ${name} (id: ${id}): ${title || instructions.slice(0, 80) || "no job yet"}`,
          )
          .join("\n")}`
      : "You have no teammates yet.",
    groups.length > 0
      ? `Groups you are in:\n${groups.map(({ id, name }) => `- ${name} (id: ${id})`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
