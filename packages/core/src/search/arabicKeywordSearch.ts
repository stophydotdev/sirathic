import { db } from "@sirathic/db";
import { type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { withoutStopwords } from "./arabic";
import { embedQuery } from "./embedding";
import type { Searchable } from "./searchable";
import { countWhere, tableSize } from "./wordCounts";

const COMMON_SHARE = 0.08;
const ARABIC_MARKS = /[ً-ٰٟـ]/gu;
const NOT_LETTERS = /[^\p{L}]/gu;

const ranked = z.array(z.object({ id: z.string() }));

export const arabicForms = (word: string) => {
  const bare = word.startsWith("ال") ? word.slice(2) : word;
  const definite = `ال${bare}`;
  return [
    ...new Set([
      bare,
      definite,
      `و${definite}`,
      `ف${definite}`,
      `ب${definite}`,
      `ك${definite}`,
      `لل${bare}`,
      `ولل${bare}`,
      `و${bare}`,
      `ب${bare}`,
      `ل${bare}`,
      `ف${bare}`,
    ]),
  ].filter((form) => form.length > 1);
};

export const arabicKeywordIds = async (
  { table, embedding, embedder }: Searchable,
  query: string,
  limit: number,
  { filter = sql`true` }: { filter?: SQL } = {},
) => {
  const words = [
    ...new Set(
      withoutStopwords(query.replaceAll(ARABIC_MARKS, ""))
        .split(/\s+/u)
        .map((word) => word.replaceAll(NOT_LETTERS, ""))
        .filter((word) => word.length > 1),
    ),
  ];
  const [total, groups] = await Promise.all([
    tableSize(table),
    Promise.all(
      words.map(async (word) => {
        const terms = arabicForms(word).join(" | ");
        return {
          terms,
          count: await countWhere(
            table,
            terms,
            sql`${table.search} @@ to_tsquery('simple', ${terms})`,
          ),
        };
      }),
    ),
  ]);
  const found = groups.filter((group) => group.count > 0);
  if (found.length === 0) return [];
  const rare = found.filter((group) => group.count < total * COMMON_SHARE);
  const required = (rare.length > 0 ? rare : found).map((group) => `(${group.terms})`).join(" | ");
  const score = sql.join(
    found.map(
      (group) =>
        sql`(case when ${table.search} @@ to_tsquery('simple', ${group.terms}) then ${Math.log(total / group.count)}::float8 else 0 end)`,
    ),
    sql` + `,
  );
  const vector = JSON.stringify(await embedQuery(embedder, query));
  const rows = await db.execute(sql`
    select ${table.id} as id from ${table}
    where ${table.search} @@ to_tsquery('simple', ${required}) and ${filter}
    order by ${score} desc, ${embedding} <=> ${vector}::halfvec
    limit ${limit}
  `);
  return ranked.parse(rows).map((row) => row.id);
};
