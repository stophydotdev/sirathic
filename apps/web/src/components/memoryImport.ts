import { MEMORY_CHARS, MEMORY_LIMIT } from "@sirathic/server/settings";

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s*/u;

export const importedFacts = (pasted: string, saved: readonly string[]) => {
  const known = new Set(saved.map((fact) => fact.toLowerCase()));
  const fresh = pasted
    .split("\n")
    .map((line) => line.replace(BULLET, "").trim().slice(0, MEMORY_CHARS))
    .filter((fact) => {
      if (!fact || known.has(fact.toLowerCase())) return false;
      known.add(fact.toLowerCase());
      return true;
    });
  return fresh.slice(0, Math.max(0, MEMORY_LIMIT - saved.length));
};
