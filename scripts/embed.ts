import { EmbedHttpError, embedMany } from "@sirathic/core/search/embedding";
import { db } from "@sirathic/db";
import { count, isNull, sql } from "drizzle-orm";
import { EMBEDDED } from "./embeddings";

const BATCH_TEXTS = 100;
const BATCH_CHARS = 60_000;
const PARALLEL_REQUESTS = 24;
const PAGE_SIZE = BATCH_TEXTS * PARALLEL_REQUESTS * 4;
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_ATTEMPTS = 8;
const RETRY_WAIT_MS = 2_000;

const only = process.argv.slice(2);
const entries = Object.entries(EMBEDDED)
  .filter(([name]) => only.length === 0 || only.includes(name))
  .map(([, entry]) => entry);

type Row = { id: string; text: string };
type Embedded = (typeof EMBEDDED)[keyof typeof EMBEDDED];

const embed = async (
  entry: Embedded,
  texts: string[],
  attempt = 1,
): ReturnType<typeof embedMany> => {
  try {
    return await embedMany(entry.embedder, texts, {
      dimensions: entry.dimensions,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
  } catch (error) {
    const transient =
      error instanceof EmbedHttpError
        ? (error.status === 429 && !error.message.includes("insufficient_quota")) ||
          error.status >= 500
        : error instanceof DOMException || error instanceof TypeError;
    if (attempt >= MAX_ATTEMPTS || !transient) throw error;
    const asked = error instanceof EmbedHttpError ? error.retryAfterMs : 0;
    await Bun.sleep(Math.max(asked, RETRY_WAIT_MS * attempt));
    return embed(entry, texts, attempt + 1);
  }
};

const chunks = (rows: Row[]) =>
  rows.reduce<Row[][]>((batches, row) => {
    const last = batches.at(-1);
    const chars = last?.reduce((sum, item) => sum + item.text.length, 0) ?? 0;
    if (last && last.length < BATCH_TEXTS && chars + row.text.length <= BATCH_CHARS) {
      last.push(row);
    } else {
      batches.push([row]);
    }
    return batches;
  }, []);

const missing = await Promise.all(
  entries.map(async ({ table, embedding }) => {
    const [found] = await db.select({ rows: count() }).from(table).where(isNull(embedding));
    return found?.rows ?? 0;
  }),
);
const total = missing.reduce((sum, rows) => sum + rows, 0);
let embedded = 0;
let spent = 0;

const store = async (entry: Embedded, rows: Row[]) => {
  const { vectors, tokens } = await embed(
    entry,
    rows.map((row) => row.text),
  );
  const values = sql.join(
    rows.map((row, index) => sql`(${row.id}, ${JSON.stringify(vectors[index])})`),
    sql`, `,
  );
  await db.execute(
    sql`update ${entry.table} set ${sql.identifier(entry.embedding.name)} = data.embedding::halfvec from (values ${values}) as data(id, embedding) where ${entry.table.id} = data.id`,
  );
  embedded += rows.length;
  spent += (tokens / 1_000_000) * entry.embedder.dollarsPerMillionTokens;
  console.log(`${embedded}/${total} embedded, $${spent.toFixed(4)} spent`);
};

const embedTable = async (entry: Embedded): Promise<void> => {
  const { table, embedding, text } = entry;
  const rows = await db
    .select({ id: table.id, text })
    .from(table)
    .where(isNull(embedding))
    .limit(PAGE_SIZE);
  if (rows.length === 0) return;
  const queue = chunks(rows);
  const work = async (): Promise<void> => {
    const batch = queue.shift();
    if (batch === undefined) return;
    await store(entry, batch);
    return work();
  };
  await Promise.all(Array.from({ length: PARALLEL_REQUESTS }, work));
  return embedTable(entry);
};

console.log(`${total} rows need embeddings`);
await entries.reduce(
  (previous: Promise<void>, entry) => previous.then(() => embedTable(entry)),
  Promise.resolve(),
);
console.log(`Done: ${embedded} rows embedded for $${spent.toFixed(4)}`);
await db.$client.end();
