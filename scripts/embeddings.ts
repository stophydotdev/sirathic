import type { db } from "@sirathic/db";
import {
  duas,
  EMBEDDING,
  fatwas,
  fiqhPassages,
  hadiths,
  REDDIT_EMBEDDING_DIMENSIONS,
  redditThreads,
  texts,
  verses,
} from "@sirathic/db/schema";
import { and, eq, getTableName, isNull, sql } from "drizzle-orm";
import { HADITH_ENGLISH_SOURCE } from "./catalog";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const FULL = EMBEDDING.dimensions;

export const EMBEDDED = {
  verses: {
    table: verses,
    text: sql<string>`${verses.textEn}`,
    dimensions: FULL,
  },
  hadiths: {
    table: hadiths,
    text: sql<string>`coalesce(${hadiths.textEn}, ${hadiths.textArClean})`,
    dimensions: FULL,
  },
  duas: {
    table: duas,
    text: sql<string>`concat_ws(' ', array_to_string(${duas.occasions}, ', '), ${duas.title}, ${duas.textEn}, ${duas.textArClean})`,
    dimensions: FULL,
  },
  fiqhPassages: {
    table: fiqhPassages,
    text: sql<string>`left(${fiqhPassages.textArClean}, 8000)`,
    dimensions: FULL,
  },
  fatwas: {
    table: fatwas,
    text: sql<string>`concat_ws(' ', ${fatwas.title}, left(coalesce(${fatwas.question}, ${fatwas.answer}), 1500))`,
    dimensions: FULL,
  },
  redditThreads: {
    table: redditThreads,
    text: sql<string>`concat_ws(' ', ${redditThreads.title}, left(${redditThreads.question}, 1500))`,
    dimensions: REDDIT_EMBEDDING_DIMENSIONS,
  },
} as const;

type Embedded = (typeof EMBEDDED)[keyof typeof EMBEDDED];

export const keepEmbeddings = async (tx: Transaction, { table, text }: Embedded) => {
  const kept = sql.identifier(`kept_${getTableName(table)}`);
  await tx.execute(
    sql`create temp table ${kept} on commit drop as select distinct on (text) ${text} as text, ${table.embedding} as embedding from ${table} where ${table.embedding} is not null`,
  );
  return () =>
    tx.execute(
      sql`update ${table} set embedding = ${kept}.embedding from ${kept} where ${text} = ${kept}.text`,
    );
};

export const fillSearchEnglish = (tx: Transaction) =>
  tx
    .update(hadiths)
    .set({ textEn: sql`${texts.body}` })
    .from(texts)
    .where(
      and(
        eq(texts.ref, hadiths.id),
        eq(texts.source, HADITH_ENGLISH_SOURCE),
        eq(texts.kind, "translation"),
        isNull(hadiths.textEn),
      ),
    );
