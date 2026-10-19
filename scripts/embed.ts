import { db } from "@sirathic/db";
import { EMBEDDING } from "@sirathic/db/schema";
import { env } from "@sirathic/env/server";
import { isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { EMBEDDED } from "./embeddings";

const BATCH_SIZE = 256;
const PARALLEL_REQUESTS = 4;

const embeddingResponse = z.object({
  data: z.array(
    z.object({
      index: z.number(),
      embedding: z.array(z.number()).length(EMBEDDING.dimensions),
    }),
  ),
  usage: z.object({ total_tokens: z.number() }),
});

type Row = { id: string; text: string };
type Batch = {
  table: (typeof EMBEDDED)[keyof typeof EMBEDDED]["table"];
  rows: Row[];
};

const apiKey = env.OPENAI_API_KEY;

const RATE_LIMIT_WAIT_MS = 2_000;

const embed = async (
  texts: string[],
): Promise<{ vectors: number[][]; cost: number }> => {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING.model, input: texts }),
  });
  if (!response.ok) {
    const body = await response.text();
    if (response.status === 429 && !body.includes("insufficient_quota")) {
      await Bun.sleep(RATE_LIMIT_WAIT_MS);
      return embed(texts);
    }
    throw new Error(`OpenAI answered HTTP ${response.status}: ${body}`);
  }
  const { data, usage } = embeddingResponse.parse(await response.json());
  const byIndex = new Map(data.map((item) => [item.index, item.embedding]));
  const vectors = texts.map((_, index) => {
    const vector = byIndex.get(index);
    if (vector === undefined)
      throw new Error(`No embedding for input ${index}`);
    return vector;
  });
  return {
    vectors,
    cost: (usage.total_tokens / 1_000_000) * EMBEDDING.dollarsPerMillionTokens,
  };
};

const chunks = (rows: Row[]) =>
  Array.from({ length: Math.ceil(rows.length / BATCH_SIZE) }, (_, index) =>
    rows.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE),
  );

const pending = await Promise.all(
  Object.values(EMBEDDED).map(async ({ table, text }) => ({
    table,
    rows: await db
      .select({ id: table.id, text })
      .from(table)
      .where(isNull(table.embedding)),
  })),
);

const queue: Batch[] = pending.flatMap(({ table, rows }) =>
  chunks(rows).map((batch) => ({ table, rows: batch })),
);
const total = pending.reduce((sum, { rows }) => sum + rows.length, 0);
let embedded = 0;
let spent = 0;

const store = async ({ table, rows }: Batch) => {
  const { vectors, cost } = await embed(rows.map((row) => row.text));
  const values = sql.join(
    rows.map(
      (row, index) => sql`(${row.id}, ${JSON.stringify(vectors[index])})`,
    ),
    sql`, `,
  );
  await db.execute(
    sql`update ${table} set embedding = data.embedding::halfvec from (values ${values}) as data(id, embedding) where ${table.id} = data.id`,
  );
  embedded += rows.length;
  spent += cost;
  console.log(`${embedded}/${total} embedded, $${spent.toFixed(4)} spent`);
};

const work = async (): Promise<void> => {
  const batch = queue.shift();
  if (batch === undefined) return;
  await store(batch);
  return work();
};

console.log(`${total} rows need embeddings with ${EMBEDDING.model}`);
await Promise.all(Array.from({ length: PARALLEL_REQUESTS }, work));
console.log(`Done: ${embedded} rows embedded for $${spent.toFixed(4)}`);
await db.$client.end();
