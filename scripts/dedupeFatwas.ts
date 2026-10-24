import { mkdir } from "node:fs/promises";
import { db } from "@sirathic/db";
import { fatwas } from "@sirathic/db/schema";
import { inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { DATA_DIR, FATWA_MIRRORS } from "./catalog";

const APPLY = process.argv.includes("--apply");

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

if (APPLY && pages.size > 0) {
  const urls = [...pages.keys()];
  const rows = await db.select().from(fatwas).where(inArray(fatwas.url, urls));
  const dir = `${DATA_DIR}/fatwas-removed`;
  await mkdir(dir, { recursive: true });
  const file = `${dir}/${new Date().toISOString().replaceAll(":", "-")}.jsonl.gz`;
  await Bun.write(
    file,
    Bun.gzipSync(rows.map((row) => JSON.stringify(row)).join("\n")),
  );
  const deleted = await db
    .delete(fatwas)
    .where(inArray(fatwas.url, urls))
    .returning({ url: fatwas.url });
  console.log(
    `saved ${rows.length} rows to ${file}, deleted ${deleted.length} rows`,
  );
}
await db.$client.end();
