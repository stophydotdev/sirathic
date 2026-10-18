import { db } from "@sirathic/db";
import { type SQL, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import { withoutStopwords } from "./arabic";
import { embedQuery } from "./embedding";

const POOL = 40;
const RRF_K = 60;
const ARABIC_MARKS = /[ً-ٰٟـ]/gu;

const ranked = z.array(z.object({ id: z.string() }));

export const hybridIds = async (
  table: PgTable,
  query: string,
  limit: number,
  {
    filter = sql`true`,
    anyWord = true,
    dropStopwords = false,
    maxDistance,
  }: {
    filter?: SQL;
    anyWord?: boolean;
    dropStopwords?: boolean;
    maxDistance?: number;
  } = {},
) => {
  const plain = query.replaceAll(ARABIC_MARKS, "");
  const words = dropStopwords ? withoutStopwords(plain) : plain;
  const vector = JSON.stringify(await embedQuery(query));
  const rows = await db.transaction(async (tx) => {
    await tx.execute(sql`set local hnsw.iterative_scan = relaxed_order`);
    return tx.execute(sql`
    with words as (
      select plainto_tsquery('english', ${words}) as every_word
    ),
    query as (
      select case when ${!anyWord} or exists (select 1 from ${table}, words where search @@ every_word and ${filter})
        then every_word else replace(every_word::text, '&', '|')::tsquery end as tsq
      from words
    ),
    keyword as (
      select id, row_number() over (order by ts_rank_cd(search, tsq) desc) as rank, embedding <=> ${vector}::halfvec as distance
      from ${table}, query
      where search @@ tsq and ${filter}
      order by ts_rank_cd(search, tsq) desc
      limit ${POOL}
    ),
    meaning as (
      select id, row_number() over (order by embedding <=> ${vector}::halfvec) as rank, embedding <=> ${vector}::halfvec as distance
      from ${table}
      where ${filter}
      order by embedding <=> ${vector}::halfvec
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
