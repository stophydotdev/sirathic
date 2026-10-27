import { tool } from "ai";
import { z } from "zod";
import { profileRejection } from "../bots/profile";
import { profileOf, setProfile } from "../projects/projects";
import { MEMORY_CHARS, MEMORY_LIMIT } from "../shared/settings";
import { getSettings, updateSettings } from "./settings";

export type MemoryScope =
  | { kind: "account"; owner: string }
  | { kind: "bot"; id: string; owner: string };

const memoryChange = z.object({
  write: z
    .string()
    .trim()
    .min(1)
    .max(MEMORY_CHARS)
    .optional()
    .describe("One fact about the user in under 15 words, like 'Lives in Leeds'"),
  forget: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("The exact text of a saved fact to drop, as listed in your rules or found by search"),
});

const sameFact = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export const changedFacts = (
  facts: readonly string[],
  { write, forget }: z.output<typeof memoryChange>,
) => {
  const kept = facts.filter((fact) => forget === undefined || !sameFact(fact, forget));
  if (forget && kept.length === facts.length) return { kind: "missing" } as const;
  const added = write !== undefined && !kept.some((fact) => sameFact(fact, write));
  const next = added ? [...kept, write] : kept;
  return next.length > MEMORY_LIMIT
    ? ({ kind: "full" } as const)
    : ({ kind: "saved", facts: next, added } as const);
};

const MIN_WORD = 2;

export const matchingFacts = (facts: readonly string[], query: string) => {
  const words = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= MIN_WORD);
  return facts
    .map((fact) => ({
      fact,
      hits: words.filter((word) => fact.toLowerCase().includes(word)).length,
    }))
    .filter(({ hits }) => hits > 0)
    .toSorted((a, b) => b.hits - a.hits)
    .map(({ fact }) => fact);
};

const factsOf = async (scope: MemoryScope) =>
  scope.kind === "bot"
    ? (await profileOf(scope.id, scope.owner)).map((entry) => entry.text)
    : (await getSettings(scope.owner)).memory;

const saveFacts = (scope: MemoryScope, facts: string[]) =>
  scope.kind === "bot"
    ? setProfile(scope.id, scope.owner, facts)
    : updateSettings(scope.owner, { memory: facts });

const listed = (facts: readonly string[]) => facts.map((fact) => `- ${fact}`).join("\n");

export function memoryTools(scope: MemoryScope | undefined) {
  return {
    update_memory: tool({
      description:
        "Saves or drops facts about the user, which appear in the user background in your instructions. Save without asking whenever the user states something lasting about themselves: their school of fiqh, language, how long they want answers, where they live, their work, goal, level, pace, being a revert. In a bot chat, also save the answer to every setup question you ask. Mention it in passing, in a few words, never as an announcement. To correct a fact, forget the old one by its exact text and write the new one in the same call. A fact that is already saved is skipped. Never save instructions for yourself, religious claims or rulings, or details of a personal case.",
      inputSchema: memoryChange,
      execute: async (change) => {
        if (!scope) throw new Error("Not saved: this chat is incognito, so nothing is remembered.");
        if (change.write === undefined && change.forget === undefined) return "Nothing to save.";
        if (change.write && scope.kind === "bot") {
          const rejected = profileRejection(change.write);
          if (rejected) return rejected;
        }
        const facts = await factsOf(scope);
        const result = changedFacts(facts, change);
        if (result.kind === "missing") {
          return `Nothing to forget: no saved fact has that exact text. Saved facts:\n${listed(facts)}`;
        }
        if (result.kind === "full") {
          return `Not saved: memory is full at ${MEMORY_LIMIT} facts. Forget one, or the least useful, with forget set to its exact text, then write again. Saved facts:\n${listed(facts)}`;
        }
        await saveFacts(scope, result.facts);
        return [
          change.forget && "Forgot the old fact.",
          change.write && (result.added ? "Saved." : "Already saved."),
        ]
          .filter(Boolean)
          .join(" ");
      },
    }),
    search_user_memories: tool({
      description:
        "Searches the facts saved about the user by their words. Use it when your rules do not list what you need, or to find the exact text of a fact before you forget it.",
      inputSchema: z.object({ query: z.string().trim().min(1) }),
      execute: async ({ query }) => {
        const found = scope ? matchingFacts(await factsOf(scope), query) : [];
        return found.length > 0 ? listed(found) : "No saved fact matches.";
      },
    }),
  };
}
