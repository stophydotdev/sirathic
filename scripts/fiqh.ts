import { existsSync } from "node:fs";
import { mkdir, rename } from "node:fs/promises";
import { db } from "@sirathic/db";
import { fiqhPassages, fiqhWorks, sources } from "@sirathic/db/schema";
import { eq } from "drizzle-orm";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import { z } from "zod";
import {
  DATA_DIR,
  FIQH_DATASET,
  FIQH_PASSAGES_FILE,
  FIQH_REVISION,
  FIQH_SOURCE,
  FIQH_WORKS,
  FIQH_WORKS_FILE,
} from "./catalog";
import { EMBEDDED, keepEmbeddings } from "./embeddings";

const CHUNK_SIZE = 1000;
const ARABIC_MARKS = /[ـً-ٰٟۖ-ۭ]/gu;
const CITATION_TAIL = /^،\s*(?:(.+)،\s*)?(\d+)\/(\d+)$/su;
const FIQH_DIR = `${DATA_DIR}/fiqh`;
const SOURCE = {
  name: FIQH_SOURCE,
  url: `https://huggingface.co/datasets/${FIQH_DATASET}`,
  version: FIQH_REVISION,
  license:
    "CC BY-NC-SA 4.0. Non-commercial use only; attribute islamlab; share alike. The texts are public domain; Shamela texts came through AuthenticIlm (MIT)",
  credit: "islamic-sciences by islamlab, CC BY-NC-SA 4.0",
};

const workRows = z.array(
  z.object({
    work_id: z.string(),
    title_ar: z.string(),
    title_lat: z.string(),
    author_ar: z.string(),
    death_year_ah: z.number(),
    source: z.string(),
  }),
);

const workIdRows = z.array(z.object({ work_id: z.string() }));

const passageRows = z.array(
  z.object({
    passage_id: z.string(),
    citation: z.string(),
    text: z.string(),
  }),
);

const catalog = new Map(Object.entries(FIQH_WORKS));

const chunks = <Row>(rows: Row[]) =>
  Array.from({ length: Math.ceil(rows.length / CHUNK_SIZE) }, (_, index) =>
    rows.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
  );

const download = async (remote: string) => {
  const path = `${FIQH_DIR}/${remote.replace("/", "-")}`;
  if (existsSync(path)) return path;
  console.log(`Downloading ${remote}`);
  const response = await fetch(
    `https://huggingface.co/datasets/${FIQH_DATASET}/resolve/${FIQH_REVISION}/${remote}`,
  );
  if (!response.ok) {
    throw new Error(
      `Hugging Face answered HTTP ${response.status} for ${remote}`,
    );
  }
  await Bun.write(`${path}.part`, response);
  await rename(`${path}.part`, path);
  return path;
};

await mkdir(FIQH_DIR, { recursive: true });
const [worksPath, passagesPath] = await Promise.all([
  download(FIQH_WORKS_FILE),
  download(FIQH_PASSAGES_FILE),
]);

const works = workRows
  .parse(
    await parquetReadObjects({
      file: await asyncBufferFromFile(worksPath),
      compressors,
      columns: [
        "work_id",
        "title_ar",
        "title_lat",
        "author_ar",
        "death_year_ah",
        "source",
      ],
    }),
  )
  .flatMap((work) => {
    const entry = catalog.get(work.work_id);
    return entry === undefined ? [] : [{ ...work, ...entry }];
  });
if (works.length !== catalog.size) {
  throw new Error(`Found ${works.length} of ${catalog.size} fiqh works`);
}

const file = await asyncBufferFromFile(passagesPath);
const ranges = workIdRows
  .parse(await parquetReadObjects({ file, compressors, columns: ["work_id"] }))
  .reduce((found, { work_id }, index) => {
    const range = found.get(work_id);
    return found.set(work_id, { start: range?.start ?? index, end: index + 1 });
  }, new Map<string, { start: number; end: number }>());

const readPassages = async (work: (typeof works)[number]) => {
  const range = ranges.get(work.work_id);
  if (range === undefined || range.end - range.start !== work.passages) {
    throw new Error(`${work.work_id} does not have ${work.passages} passages`);
  }
  const rows = passageRows.parse(
    await parquetReadObjects({
      file,
      compressors,
      columns: ["passage_id", "citation", "text"],
      rowStart: range.start,
      rowEnd: range.end,
    }),
  );
  return rows.map((row) => {
    const at = row.citation.indexOf(work.title_ar);
    const tail = CITATION_TAIL.exec(
      row.citation.slice(at + work.title_ar.length),
    );
    if (at < 0 || tail === null) {
      throw new Error(`Cannot read ${row.passage_id}: ${row.citation}`);
    }
    return {
      id: `fiqh:${row.passage_id}`,
      workId: work.work_id,
      school: work.school,
      volume: Number(tail[2]),
      page: Number(tail[3]),
      heading: tail[1]?.trim() || null,
      textAr: row.text,
      textArClean: row.text.replace(ARABIC_MARKS, ""),
    };
  });
};

const readAll = async (
  pending: typeof works,
): Promise<Awaited<ReturnType<typeof readPassages>>> => {
  const [work, ...rest] = pending;
  if (work === undefined) return [];
  return (await readPassages(work)).concat(await readAll(rest));
};

const passages = await readAll(works);

await db.transaction(async (tx) => {
  const restorePassages = await keepEmbeddings(tx, EMBEDDED.fiqhPassages);
  await tx.delete(fiqhPassages);
  await tx.delete(fiqhWorks);
  await tx.delete(sources).where(eq(sources.name, SOURCE.name));
  await tx.insert(fiqhWorks).values(
    works.map((work) => ({
      id: work.work_id,
      titleAr: work.title_ar,
      titleLat: work.title_lat,
      authorAr: work.author_ar,
      deathYearAh: work.death_year_ah,
      school: work.school,
      source: work.source,
    })),
  );
  await Promise.all(
    chunks(passages).map((rows) => tx.insert(fiqhPassages).values(rows)),
  );
  await tx.insert(sources).values(SOURCE);
  await restorePassages();
});

console.log(`Loaded ${works.length} fiqh works, ${passages.length} passages`);
await db.$client.end();
