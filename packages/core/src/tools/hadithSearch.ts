import { z } from "zod";
import { hybridIds } from "../search/hybridSearch";
import { SEARCHABLE } from "../search/searchable";
import { hadithsByIds } from "./hadithGet";
import { trustedHadith } from "./trustedHadith";

export const hadithSearchInput = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(20).default(8),
});

export const hadithSearch = async (input: z.input<typeof hadithSearchInput>) => {
  const { query, limit } = hadithSearchInput.parse(input);
  const hits = await hybridIds(SEARCHABLE.hadiths, query, limit, {
    rareWords: true,
    filter: trustedHadith,
  });
  const distances = new Map(hits.map(({ id, distance }) => [id, distance]));
  const found = await hadithsByIds(hits.map(({ id }) => id));
  return {
    hadiths: found.map((hadith) =>
      Object.assign(hadith, { distance: distances.get(hadith.id) ?? Number.POSITIVE_INFINITY }),
    ),
  };
};
