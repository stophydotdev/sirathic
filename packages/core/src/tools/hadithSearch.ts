import { z } from "zod";
import { hybridIds } from "../search/hybridSearch";
import { SEARCHABLE } from "../search/searchable";
import { hadithsByIds } from "./hadithGet";

export const hadithSearchInput = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(20).default(8),
});

export const hadithSearch = async (input: z.input<typeof hadithSearchInput>) => {
  const { query, limit } = hadithSearchInput.parse(input);
  return {
    hadiths: await hadithsByIds(
      await hybridIds(SEARCHABLE.hadiths, query, limit, { rareWords: true }),
    ),
  };
};
