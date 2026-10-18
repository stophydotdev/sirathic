import { db } from "@sirathic/db";
import { fatwas } from "@sirathic/db/schema";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { hybridIds } from "../search/hybridSearch";

const ROWS_PER_PAGE = 3;

const EVERY_WORD = { anyWord: false };

export const fatwaSearchInput = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(20).default(6),
});

export const fatwaSearch = async (input: z.input<typeof fatwaSearchInput>) => {
  const { query, limit } = fatwaSearchInput.parse(input);
  const ids = await hybridIds(fatwas, query, limit * ROWS_PER_PAGE, EVERY_WORD);
  if (ids.length === 0) return { fatwas: [] };
  const rows = await db
    .select({
      id: fatwas.id,
      url: fatwas.url,
      title: fatwas.title,
      answeredBy: fatwas.answeredBy,
      school: fatwas.school,
      question: fatwas.question,
      summary: fatwas.summary,
      answer: fatwas.answer,
      publishedAt: fatwas.publishedAt,
    })
    .from(fatwas)
    .where(inArray(fatwas.id, ids));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const pages = new Set<string>();
  const best = ids.flatMap((id) => {
    const row = byId.get(id);
    if (row === undefined || pages.has(row.url)) return [];
    pages.add(row.url);
    return [row];
  });
  return { fatwas: best.slice(0, limit) };
};
