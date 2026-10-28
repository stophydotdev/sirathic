import { fiqhPassages } from "@sirathic/db/schema";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { hybridIds } from "../search/hybridSearch";
import { SEARCHABLE } from "../search/searchable";
import { passagesByIds } from "./fiqhGet";

const SCHOOLS = ["hanafi", "maliki", "shafii", "hanbali", "comparative"] as const;

export const fiqhSearchInput = z.object({
  query: z.string().trim().min(1),
  school: z.enum(SCHOOLS).optional(),
  limit: z.number().int().min(1).max(20).default(6),
});

export const fiqhSearch = async (input: z.input<typeof fiqhSearchInput>) => {
  const { query, school, limit } = fiqhSearchInput.parse(input);
  const filter = school === undefined ? sql`true` : sql`${fiqhPassages.school} = ${school}`;
  const hits = await hybridIds(SEARCHABLE.fiqhPassages, query, limit, { filter, rareWords: true });
  const distances = new Map(hits.map(({ id, distance }) => [id, distance]));
  const found = await passagesByIds(hits.map(({ id }) => id));
  return {
    passages: found.map((passage) =>
      Object.assign(passage, { distance: distances.get(passage.id) ?? Number.POSITIVE_INFINITY }),
    ),
  };
};
