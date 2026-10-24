import { db } from "@sirathic/db";
import { getTableName, type SQL, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import { cacheFor } from "../cache";

const MONTH_MS = 30 * 24 * 60 * 60_000;

const counted = z.array(z.object({ count: z.number() }));
const counts = cacheFor({
  namespace: "word-count:v1",
  schema: z.number(),
  freshMs: MONTH_MS,
  keepMs: MONTH_MS,
});

export const countWhere = (table: PgTable, key: string, match: SQL) =>
  counts(
    `${getTableName(table)}:${key}`,
    async () =>
      counted.parse(
        await db.execute(sql`select count(*)::int as count from ${table} where ${match}`),
      )[0]?.count ?? 0,
  );

export const tableSize = (table: PgTable) => countWhere(table, "", sql`true`);
