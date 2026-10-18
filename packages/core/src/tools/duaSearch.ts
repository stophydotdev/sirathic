import { db } from "@sirathic/db";
import { duas } from "@sirathic/db/schema";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { hybridIds } from "../search/hybridSearch";

const DUA_WORDS =
  /(?<=^|\s)(دعاء|الدعاء|أدعية|ادعية|ذكر|أذكار|اذكار|dua|duaa|du'a|supplications?|dhikr|adhkar)(?=\s|$)/giu;

export const duaSearchInput = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .describe(
      'The occasion or need, such as "before sleeping", "anxiety" or "entering the mosque"',
    ),
  limit: z.number().int().min(1).max(10).default(5),
});

export const duaSearch = async (input: z.input<typeof duaSearchInput>) => {
  const { query, limit } = duaSearchInput.parse(input);
  const topic = query.replaceAll(DUA_WORDS, " ").trim() || query;
  const ids = await hybridIds(duas, topic, limit);
  if (ids.length === 0) return { duas: [] };
  const rows = await db
    .select({
      id: duas.id,
      title: duas.title,
      occasions: duas.occasions,
      textAr: duas.textAr,
      textEn: duas.textEn,
      explanation: duas.explanation,
      attribution: duas.attribution,
      grade: duas.grade,
      hadithId: duas.hadithId,
    })
    .from(duas)
    .where(inArray(duas.id, ids));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return { duas: ids.flatMap((id) => byId.get(id) ?? []) };
};
