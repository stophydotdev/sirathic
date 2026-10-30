import { cacheManyFor } from "@sirathic/core/cache";
import { z } from "zod";
import { CLEF, yesChances } from "./clef";

const RELEVANT = 0.3;
const NEEDS_SOURCES = 0.1;
const SHORT_MESSAGE_CHARS = 50;
const WEEK_MS = 7 * 24 * 60 * 60_000;

const scoreCache = cacheManyFor({ namespace: "clef:v1", schema: z.number(), keepMs: WEEK_MS });

const digest = (...parts: string[]) =>
  new Bun.CryptoHasher("sha256").update(parts.join("\u0000")).digest("hex");

const askClef = async (search: string, heads: string[]) => {
  const chance = await yesChances(
    {
      search,
      passages: Object.fromEntries(heads.map((text, index) => [`p${index + 1}`, text])),
    },
    Object.fromEntries(
      heads.map((_, index) => [
        `p${index + 1}`,
        `Does passage p${index + 1} directly help answer the search?`,
      ]),
    ),
  );
  return heads.map((_, index) => chance(`p${index + 1}`));
};

export const relevant = async <Item>(
  search: string,
  items: readonly Item[],
  head: (item: Item) => string,
) => {
  if (items.length === 0) return { kept: [...items], dropped: [] };
  try {
    const entries = items.map((item) => {
      const text = head(item);
      return { item, text, key: digest(CLEF, search, text) };
    });
    const known = await scoreCache.read(entries.map(({ key }) => key));
    const pending = entries.filter((_, index) => known[index] === undefined);
    const asked =
      pending.length === 0
        ? []
        : await askClef(
            search,
            pending.map(({ text }) => text),
          );
    const fresh = new Map(pending.map(({ key }, position) => [key, asked[position]]));
    await scoreCache.write(
      pending.flatMap(({ key }) => {
        const score = fresh.get(key);
        return score === undefined ? [] : [[key, score]];
      }),
    );
    const scored = entries.map(({ item, key }, index) => ({
      item,
      score: known[index] ?? fresh.get(key) ?? 0,
    }));
    const best = Math.max(...scored.map(({ score }) => score));
    const keeps = ({ score }: { score: number }) => score >= RELEVANT || score === best;
    return {
      kept: scored.filter(keeps).map(({ item }) => item),
      dropped: scored.filter((entry) => !keeps(entry)).map(({ item }) => item),
    };
  } catch (err) {
    console.warn(`relevance check failed: ${err instanceof Error ? err.message : String(err)}`);
    return { kept: [...items], dropped: [] };
  }
};

export const needsSources = async (message: string) => {
  if (message.trim().length > SHORT_MESSAGE_CHARS) return true;
  try {
    const chance = await yesChances(message, {
      sources:
        "Does answering this message need looking something up in Islamic sources (Quran, hadith, fiqh books, fatwas)?",
    });
    return (chance("sources") ?? 0) >= NEEDS_SOURCES;
  } catch (err) {
    console.warn(`search check failed: ${err instanceof Error ? err.message : String(err)}`);
    return true;
  }
};
