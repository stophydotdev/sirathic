import { db } from "@sirathic/db";
import { type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import { withoutStopwords } from "./arabic";
import { arabicForms } from "./arabicKeywordSearch";
import { embedQuery } from "./embedding";
import { countWhere, tableSize } from "./wordCounts";

const POOL = 40;
const RRF_K = 60;
const COMMON_SHARE = 0.08;
const ARABIC = /\p{Script=Arabic}/u;
const ARABIC_MARKS = /[ً-ٰٟـ]/gu;

const ranked = z.array(z.object({ id: z.string() }));

export type Searchable = PgTable & {
  id: AnyPgColumn;
  search: AnyPgColumn;
  embedding: AnyPgColumn;
};

const wordQuery = (word: string) =>
  ARABIC.test(word)
    ? sql`to_tsquery('simple', ${arabicForms(word).join(" | ")})`
    : sql`plainto_tsquery('english', ${word})`;

const rareWordScore = async (table: Searchable, query: string) => {
  const words = [
    ...new Set(
      withoutStopwords(query.replaceAll(ARABIC_MARKS, ""))
        .toLowerCase()
        .split(/[^\p{L}]+/u)
        .filter((word) => word.length > 1),
    ),
  ];
  const [total, groups] = await Promise.all([
    tableSize(table),
    Promise.all(
      words.map(async (word) => {
        const match = sql`${table.search} @@ ${wordQuery(word)}`;
        return { match, count: await countWhere(table, `word:${word}`, match) };
      }),
    ),
  ]);
  const found = groups.filter((group) => group.count > 0);
  if (found.length === 0) return undefined;
  const rare = found.filter((group) => group.count < total * COMMON_SHARE);
  return {
    required: sql.join(
      (rare.length > 0 ? rare : found).map((group) => group.match),
      sql` or `,
    ),
    score: sql.join(
      found.map(
        (group) =>
          sql`(case when ${group.match} then ${Math.log(total / group.count)}::float8 else 0 end)`,
      ),
      sql` + `,
    ),
  };
};

export const hybridIds = async (
  table: Searchable,
  query: string,
  limit: number,
  {
    filter = sql`true`,
    anyWord = true,
    rareWords = false,
    dropStopwords = false,
    maxDistance,
  }: {
    filter?: SQL;
    anyWord?: boolean;
    rareWords?: boolean;
    dropStopwords?: boolean;
    maxDistance?: number;
  } = {},
) => {
  const plain = query.replaceAll(ARABIC_MARKS, "");
  const words = dropStopwords ? withoutStopwords(plain) : plain;
  const [vector, rare] = await Promise.all([
    embedQuery(query).then((embedding) => JSON.stringify(embedding)),
    rareWords ? rareWordScore(table, query) : undefined,
  ]);
  const distance = sql`${table.embedding} <=> ${vector}::halfvec`;
  const keyword = !rareWords
    ? sql`select ${table.id} as id, row_number() over (order by ts_rank_cd(${table.search}, tsq) desc) as rank
      from ${table}, query
      where ${table.search} @@ tsq and ${filter}
      order by ts_rank_cd(${table.search}, tsq) desc
      limit ${POOL}`
    : rare
      ? sql`select ${table.id} as id, row_number() over (order by ${rare.score} desc, ${distance}) as rank
      from ${table}
      where (${rare.required}) and ${filter}
      order by ${rare.score} desc, ${distance}
      limit ${POOL}`
      : sql`select ${table.id} as id, 1::bigint as rank from ${table} where false`;
  const rows = await db.transaction(async (tx) => {
    await tx.execute(sql`set local hnsw.iterative_scan = relaxed_order`);
    return tx.execute(sql`
    with words as (
      select plainto_tsquery('english', ${words}) as every_word
    ),
    query as (
      select case when ${!anyWord} or exists (select 1 from ${table}, words where ${table.search} @@ every_word and ${filter})
        then every_word else replace(every_word::text, '&', '|')::tsquery end as tsq
      from words
    ),
    keyword as (${keyword}),
    meaning as (
      select ${table.id} as id, row_number() over (order by ${table.embedding} <=> ${vector}::halfvec) as rank, ${table.embedding} <=> ${vector}::halfvec as distance
      from ${table}
      where ${filter}
      order by ${table.embedding} <=> ${vector}::halfvec
      limit ${POOL}
    )
    select id
    from keyword full join meaning using (id)
    where ${maxDistance ?? null}::float8 is null or keyword.rank is not null or meaning.distance <= ${maxDistance ?? null}::float8
    order by coalesce(1.0 / (${RRF_K}::int + keyword.rank), 0) + coalesce(1.0 / (${RRF_K}::int + meaning.rank), 0) desc
    limit ${limit}
  `);
  });
  return ranked.parse(rows).map((row) => row.id);
};
