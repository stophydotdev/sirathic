import { verses } from "@sirathic/db/schema";
import { z } from "zod";
import { hybridIds } from "../search/hybridSearch";
import { tafsirEnFor, versesByIds } from "./quranGet";

export const quranSearchInput = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(20).default(8),
});

const ARABIC = /[\u0600-\u06FF]/u;
const ENGLISH_MAX_DISTANCE = 0.55;

export const quranSearch = async (input: z.input<typeof quranSearchInput>) => {
  const { query, limit } = quranSearchInput.parse(input);
  const ids = await hybridIds(verses, query, limit, {
    anyWord: false,
    maxDistance: ARABIC.test(query) ? undefined : ENGLISH_MAX_DISTANCE,
  });
  const [found, tafsirEn] = await Promise.all([versesByIds(ids), tafsirEnFor(ids)]);
  return { verses: found, tafsirEn };
};
