import { fiqhPassages } from "@sirathic/db/schema";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { arabicKeywordIds } from "../search/arabicKeywordSearch";
import { hybridIds } from "../search/hybridSearch";
import { passagesByIds } from "./fiqhGet";

const SCHOOLS = [
  "hanafi",
  "maliki",
  "shafii",
  "hanbali",
  "comparative",
] as const;

export const fiqhSearchInput = z.object({
  query: z.string().trim().min(1),
  school: z.enum(SCHOOLS).optional(),
  limit: z.number().int().min(1).max(20).default(6),
});

const ARABIC = /[؀-ۿ]/u;

export const fiqhSearch = async (input: z.input<typeof fiqhSearchInput>) => {
  const { query, school, limit } = fiqhSearchInput.parse(input);
  const filter =
    school === undefined ? sql`true` : sql`${fiqhPassages.school} = ${school}`;
  const keywordIds = ARABIC.test(query)
    ? await arabicKeywordIds(fiqhPassages, query, limit, { filter })
    : [];
  return {
    passages: await passagesByIds(
      keywordIds.length > 0
        ? keywordIds
        : await hybridIds(fiqhPassages, query, limit, {
            filter,
            dropStopwords: true,
          }),
    ),
  };
};
