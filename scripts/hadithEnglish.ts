import { db } from "@sirathic/db";
import { hadiths, sources, texts } from "@sirathic/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { DATA_DIR, HADITH_ENGLISH_SOURCE } from "./catalog";
import { fillSearchEnglish } from "./embeddings";

const APPLY = process.argv.includes("--apply");
const CHUNK_SIZE = 1_000;

const source = {
  name: HADITH_ENGLISH_SOURCE,
  url: "https://github.com/stophydotdev/sirathic",
  version: "claude-sonnet-5-5, 2026-10-18",
  license:
    "Our own machine translation of the Arabic, made with Claude Sonnet 5.5 for hadiths that have no licensed English",
  credit: null,
};

const { translated, failed } = z
  .object({
    translated: z.record(z.string(), z.string().min(1)),
    failed: z.record(z.string(), z.string()),
  })
  .parse(await Bun.file(`${DATA_DIR}/translations/hadiths.json`).json());

const rows = Object.entries(translated).map(([ref, body]) => ({
  ref,
  source: HADITH_ENGLISH_SOURCE,
  kind: "translation" as const,
  lang: "en" as const,
  body,
}));
const chunks = Array.from({ length: Math.ceil(rows.length / CHUNK_SIZE) }, (_, index) =>
  rows.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
);

const checked = await Promise.all(
  chunks.map(async (chunk) => {
    const refs = chunk.map((row) => row.ref);
    const [found, licensed] = await Promise.all([
      db.select({ id: hadiths.id }).from(hadiths).where(inArray(hadiths.id, refs)),
      db
        .select({ ref: texts.ref })
        .from(texts)
        .where(
          and(
            eq(texts.source, "hadeethenc-en"),
            eq(texts.kind, "translation"),
            inArray(texts.ref, refs),
          ),
        ),
    ]);
    return { missing: refs.length - found.length, licensed: licensed.length };
  }),
);
const total = (key: keyof (typeof checked)[number]) =>
  checked.reduce((sum, chunk) => sum + chunk[key], 0);

console.log(
  `${rows.length} translations, ${Object.keys(failed).length} failed, ${total("missing")} with no hadith, ${total("licensed")} that already have licensed English`,
);

if (APPLY) {
  await db.transaction(async (tx) => {
    await tx
      .insert(sources)
      .values(source)
      .onConflictDoUpdate({ target: sources.name, set: source });
    await tx.delete(texts).where(eq(texts.source, HADITH_ENGLISH_SOURCE));
    await Promise.all(chunks.map((chunk) => tx.insert(texts).values(chunk)));
    await fillSearchEnglish(tx);
  });
  console.log(`stored ${rows.length} rows as ${HADITH_ENGLISH_SOURCE}`);
} else console.log("dry run: rerun with --apply to store them");
await db.$client.end();
