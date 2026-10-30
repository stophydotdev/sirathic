import type { Settings } from "@sirathic/server/settings";

export type Draft = Pick<Settings, "name" | "about" | "madhab" | "instructions">;

export const draftOf = ({ name, about, madhab, instructions }: Draft): Draft => ({
  name: name.trim(),
  about: about.trim(),
  madhab,
  instructions: instructions.trim(),
});

export const sameDraft = (a: Draft, b: Draft) =>
  JSON.stringify(draftOf(a)) === JSON.stringify(draftOf(b));
