import { yesChances } from "./jev";

const RELEVANT = 0.3;
const NEEDS_SOURCES = 0.1;
const SHORT_MESSAGE_CHARS = 50;

export const relevant = async <Item>(
  search: string,
  items: readonly Item[],
  head: (item: Item) => string,
) => {
  if (items.length === 0) return { kept: [...items], dropped: [] };
  try {
    const chance = await yesChances(
      {
        search,
        passages: Object.fromEntries(items.map((item, index) => [`p${index + 1}`, head(item)])),
      },
      Object.fromEntries(
        items.map((_, index) => [
          `p${index + 1}`,
          `Does passage p${index + 1} directly help answer the search?`,
        ]),
      ),
    );
    const scored = items.map((item, index) => ({ item, score: chance(`p${index + 1}`) }));
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
    return chance("sources") >= NEEDS_SOURCES;
  } catch (err) {
    console.warn(`search check failed: ${err instanceof Error ? err.message : String(err)}`);
    return true;
  }
};
