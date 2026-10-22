import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { db } from "@sirathic/db";
import { fatwas } from "@sirathic/db/schema";
import { inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { DATA_DIR, FATWA_MIRRORS } from "./catalog";

const APPLY = process.argv.includes("--apply");
const BATCH_SIZE = 1_000;

const mirrors = JSON.stringify(FATWA_MIRRORS);

const duplicate = z.object({
  url: z.string(),
  kept: z.string(),
  reason: z.enum(["mirror", "repeat"]),
});

const removable = z.array(duplicate).parse([
  ...(await db.execute(sql`
  with pages as (
    select ${fatwas.url} as url, ${fatwas.source} as source, split_part(${fatwas.url}, '/', 5) as section,
      regexp_replace(lower(${fatwas.title}), '[^a-z0-9؀-ۿ]+', '', 'g') as title_key,
      left(regexp_replace(lower(${fatwas.answer}), '[^a-z0-9؀-ۿ]+', '', 'g'), 300) as answer_key,
      md5(${fatwas.answer}) as answer_hash, length(${fatwas.answer}) as size
    from ${fatwas} where ${fatwas.id} not like '%#%'
  ),
  mirror_copies as (
    select distinct on (url) url, kept, 'mirror' as reason from (
      select m.url, o.url as kept from pages m join pages o on m.answer_key = o.answer_key
      where m.source = 'islamqa.org' and o.source <> 'islamqa.org' and length(m.answer_key) >= 200
      union all
      select m.url, o.url from pages m join pages o on m.title_key = o.title_key
      where m.source = 'islamqa.org' and o.source = (${mirrors}::jsonb ->> m.section) and length(m.title_key) >= 15
    ) matched
  ),
  repeats as (
    select url, kept, 'repeat' as reason from (
      select url, first_value(url) over same as kept, row_number() over same as rank
      from pages where size >= 400
      window same as (partition by answer_hash order by (source = 'islamqa.org'), url)
    ) ranked where rank > 1
  )
  select * from mirror_copies union select * from repeats where url not in (select url from mirror_copies)`)),
]);

const pages = new Map(removable.map((row) => [row.url, row]));
const counts = new Map<string, number>();
for (const row of pages.values()) {
  const key = `${row.reason}: ${new URL(row.url).hostname}/${row.url.split("/")[4] ?? ""}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}
console.log(`${pages.size} duplicate pages to remove:`);
for (const [key, count] of [...counts]
  .toSorted((a, b) => b[1] - a[1])
  .slice(0, 15))
  console.log(`  ${key}: ${count}`);
for (const row of [...pages.values()].slice(0, 5))
  console.log(`  e.g. ${row.url}\n       same as ${row.kept}`);

const deleteBatches = async ([batch, ...rest]: string[][]): Promise<number> => {
  if (batch === undefined) return 0;
  const gone = await db
    .delete(fatwas)
    .where(inArray(fatwas.url, batch))
    .returning({ url: fatwas.url });
  return gone.length + (await deleteBatches(rest));
};
if (APPLY && pages.size > 0) {
  const urls = [...pages.keys()];
  const batches = Array.from(
    { length: Math.ceil(urls.length / BATCH_SIZE) },
    (_, index) => urls.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE),
  );
  const dir = `${DATA_DIR}/fatwas-removed`;
  await mkdir(dir, { recursive: true });
  const file = `${dir}/${new Date().toISOString().replaceAll(":", "-")}.jsonl.gz`;
  let saved = 0;
  await pipeline(
    Readable.from(batches).map(async (batch) => {
      const rows = await db
        .select()
        .from(fatwas)
        .where(inArray(fatwas.url, batch));
      saved += rows.length;
      return rows.map((row) => `${JSON.stringify(row)}\n`).join("");
    }),
    createGzip(),
    createWriteStream(file),
  );
  const deleted = await deleteBatches(batches);
  console.log(`saved ${saved} rows to ${file}, deleted ${deleted} rows`);
}
await db.$client.end();
