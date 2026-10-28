import { db } from "@sirathic/db";
import { getTableName, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { cacheFor, dataVersion } from "../cache";
import { arabicForms, withoutStopwords } from "./arabic";
import { embedQuery } from "./embedding";
import type { Searchable } from "./searchable";
import { countWhere, tableSize } from "./wordCounts";

const POOL = 40;
const WEEK_MS = 7 * 24 * 60 * 60_000;
const RRF_K = 60;
const COMMON_SHARE = 0.08;
const ARABIC = /\p{Script=Arabic}/u;
const ARABIC_MARKS = /[ً-ٰٟـ]/gu;

const ranked = z.array(z.object({ id: z.string(), distance: z.number() }));

const idsCache = cacheFor({
  namespace: "search-ids:v1",
  schema: ranked,
  freshMs: WEEK_MS,
  keepMs: WEEK_MS,
});

export type Filter = { where: SQL; key: string };

const wordQuery = (word: string) =>
  ARABIC.test(word)
    ? sql`to_tsquery('simple', ${arabicForms(word).join(" | ")})`
    : sql`plainto_tsquery('english', ${word})`;

const rareWordScore = async (table: Searchable["table"], query: string) => {
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

type Options = {
  filter?: Filter;
  topUp?: boolean;
  rareWords?: boolean;
  maxDistance?: number;
};

const searchIds = async (
  { table, embedding, embedder }: Searchable,
  query: string,
  limit: number,
  {
    filter: { where: filter } = { where: sql`true`, key: "" },
    topUp = false,
    rareWords = false,
    maxDistance,
  }: Options,
) => {
  const plain = query.replaceAll(ARABIC_MARKS, "");
  const [vector, rare] = await Promise.all([
    embedQuery(embedder, query).then((values) => JSON.stringify(values)),
    rareWords || topUp ? rareWordScore(table, query) : undefined,
  ]);
  const distance = sql`${embedding} <=> ${vector}::halfvec`;
  const exact = sql`select ${table.id} as id, row_number() over (order by ts_rank_cd(${table.search}, every_word) desc) as rank
      from ${table}, words
      where ${table.search} @@ every_word and ${filter}
      order by ts_rank_cd(${table.search}, every_word) desc
      limit ${POOL}`;
  const keyword = rareWords
    ? rare
      ? sql`select ${table.id} as id, row_number() over (order by ${rare.score} desc, ${distance}) as rank
      from ${table}
      where (${rare.required}) and ${filter}
      order by ${rare.score} desc, ${distance}
      limit ${POOL}`
      : sql`select ${table.id} as id, 1::bigint as rank from ${table} where false`
    : rare
      ? sql`with exact as (${exact}),
      more as (
        select ${table.id} as id, row_number() over (order by ${rare.score} desc) as rank
        from ${table}
        where (select count(*) from exact) < ${POOL} and (${rare.required}) and ${filter}
        order by ${rare.score} desc
        limit ${POOL}
      )
      select id, rank from exact
      union all
      select id, rank + (select count(*) from exact) from more where id not in (select id from exact)`
      : exact;
  const rows = await db.transaction(async (tx) => {
    await tx.execute(sql`set local hnsw.iterative_scan = relaxed_order`);
    await tx.execute(sql`set local enable_seqscan = off`);
    return tx.execute(sql`
    with words as (
      select plainto_tsquery('english', ${plain}) as every_word
    ),
    keyword as (${keyword}),
    meaning as (
      select ${table.id} as id, row_number() over (order by ${embedding} <=> ${vector}::halfvec) as rank, ${embedding} <=> ${vector}::halfvec as distance
      from ${table}
      where ${filter}
      order by ${embedding} <=> ${vector}::halfvec
      limit ${POOL}
    )
    select id, coalesce(
      meaning.distance,
      (select ${embedding} <=> ${vector}::halfvec from ${table} where ${table.id} = coalesce(keyword.id, meaning.id)),
      2
    )::float8 as distance
    from keyword full join meaning using (id)
    where ${maxDistance ?? null}::float8 is null or keyword.rank is not null or meaning.distance <= ${maxDistance ?? null}::float8
    order by coalesce(1.0 / (${RRF_K}::int + keyword.rank), 0) + coalesce(1.0 / (${RRF_K}::int + meaning.rank), 0) desc
    limit ${limit}
  `);
  });
  return ranked.parse(rows);
};

export const hybridIds = async (
  source: Searchable,
  query: string,
  limit: number,
  options: Options = {},
) => {
  const { filter, topUp, rareWords, maxDistance } = options;
  const flags = [filter?.key, topUp, rareWords, maxDistance].join("|");
  const text = query.trim().replaceAll(/\s+/gu, " ").toLowerCase();
  return idsCache(
    `${await dataVersion()}:${getTableName(source.table)}:${source.embedder.model}:${limit}:${flags}:${text}`,
    () => searchIds(source, query, limit, options),
  );
};
