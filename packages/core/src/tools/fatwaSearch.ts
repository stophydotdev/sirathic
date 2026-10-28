import { db } from "@sirathic/db";
import { fatwas } from "@sirathic/db/schema";
import { inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { hybridIds } from "../search/hybridSearch";
import { SEARCHABLE } from "../search/searchable";
import { onePerAnswer } from "../search/onePerAnswer";
import { siteHost } from "../web/url";

const ROWS_PER_PAGE = 3;

const EVERY_WORD = { anyWord: false };

const onSites = (sites: string[]) => {
  const hosts = sites.map((site) => site.replaceAll(".", "\\.")).join("|");
  return sql`${fatwas.url} ~* ${`^https?://([^/]+\\.)?(${hosts})(/|$)`}`;
};

export const fatwaSearchInput = z.object({
  query: z.string().trim().min(1),
  sites: z.array(siteHost).max(5).default([]),
  limit: z.number().int().min(1).max(20).default(6),
});

export const fatwaSearch = async (input: z.input<typeof fatwaSearchInput>) => {
  const { query, sites, limit } = fatwaSearchInput.parse(input);
  const filter = sites.length === 0 ? sql`true` : onSites(sites);
  const ids = await hybridIds(SEARCHABLE.fatwas, query, limit * ROWS_PER_PAGE, {
    ...EVERY_WORD,
    filter,
  });
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
  const ranked = ids.flatMap((id) => byId.get(id) ?? []);
  return { fatwas: onePerAnswer(ranked).slice(0, limit) };
};
