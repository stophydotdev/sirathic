import { env } from "@sirathic/env/server";
import { z } from "zod";

const JEV = "typesafeai-jev-1-14-0";
const RELEVANT = 0.3;
const WAIT_MS = 5_000;

const decided = z.object({ answers: z.record(z.string(), z.object({ noul: z.number() })) });

export const relevant = async <Item>(
  search: string,
  items: readonly Item[],
  head: (item: Item) => string,
) => {
  if (items.length === 0) return { kept: [...items], dropped: [] };
  try {
    const res = await fetch(`${env.NEON_AI_GATEWAY_BASE_URL}/typesafe/v1/systemone`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.NEON_AI_GATEWAY_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: JEV,
        state: {
          search,
          passages: Object.fromEntries(items.map((item, index) => [`p${index + 1}`, head(item)])),
        },
        questions: Object.fromEntries(
          items.map((_, index) => [
            `p${index + 1}`,
            {
              type: "noul",
              instructions: `Does passage p${index + 1} directly help answer the search?`,
            },
          ]),
        ),
      }),
      signal: AbortSignal.timeout(WAIT_MS),
    });
    if (!res.ok) throw new Error(`Jev answered ${res.status}`);
    const { answers } = decided.parse(await res.json());
    const scored = items.map((item, index) => ({
      item,
      score: answers[`p${index + 1}`]?.noul ?? 0,
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
