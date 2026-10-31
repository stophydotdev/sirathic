import { Database } from "bun:sqlite";
import { unzipSync } from "fflate";
import { z } from "zod";
import { wordsMeanings, type curatedFile } from "../../apps/data/src/schema";
import { groupBy, mapLimit } from "./util";
import type { Output } from "./output";
import { download, fetchJson, hadeethEncSource } from "./sources";

type CuratedFile = z.infer<typeof curatedFile>;

const languageList = z.array(z.object({ code: z.string(), native: z.string() }));

const jsonList = <Item extends z.ZodType>(item: Item) =>
  z
    .string()
    .nullable()
    .transform((text) => (text ? z.array(item).parse(JSON.parse(text)) : []));

const arabicRow = z.object({
  id: z.number(),
  title: z.string(),
  hadeeth: z.string(),
  explanation: z.string(),
  hints: jsonList(z.string()),
  words_meanings: z.string().nullable(),
  grade: z.string(),
  attribution: z.string(),
  reference: z.string(),
  version: z.number(),
});

const translatedRow = z.object({
  id: z.number(),
  title: z.string(),
  hadeeth: z.string(),
  explanation: z.string(),
  hints: jsonList(z.string()),
  grade: z.string(),
  attribution: z.string(),
  hadeeth_ar: z.string(),
  ar_version: z.number(),
});

const categoryRow = z.object({ id: z.number(), title: z.string(), parent_id: z.number() });

const link = z.object({ category_id: z.number(), hadeeth_id: z.number() });

const pad = (value: number) => String(value).padStart(2, "0");

const zipDate = (zip: Uint8Array) => {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const date = view.getUint16(12, true);
  return `${((date >> 9) & 127) + 1980}-${pad((date >> 5) & 15)}-${pad(date & 31)}`;
};

const openLanguage = async (rawDir: string, code: string) => {
  const zipPath = await download(
    `https://hadeethenc.com/downloads/sqlite/${code}.sqlite.zip`,
    `${rawDir}/hadeethenc/${code}.sqlite.zip`,
  );
  const zip = new Uint8Array(await Bun.file(zipPath).arrayBuffer());
  const sqlitePath = `${rawDir}/hadeethenc/${code}.sqlite`;
  const [file] = Object.values(unzipSync(zip));
  if (!file) throw new Error(`empty download for ${code}`);
  await Bun.write(sqlitePath, file);
  return { db: new Database(sqlitePath, { readonly: true }), date: zipDate(zip) };
};

export type CuratedLanguage = { code: string; native: string; date: string };

export const buildCurated = async (rawDir: string, output: Output) => {
  const languages = await fetchJson("https://hadeethenc.com/api/v1/languages", languageList);
  const opened = await mapLimit(languages, 6, async (language) => ({
    ...language,
    ...(await openLanguage(rawDir, language.code)),
  }));
  const arabic = opened.find((entry) => entry.code === "ar");
  if (!arabic) throw new Error("HadeethEnc has no Arabic download");
  const dates = new Map(opened.map((entry) => [entry.code, entry.date]));
  const source = hadeethEncSource(
    opened
      .map((entry) => entry.date)
      .toSorted()
      .at(-1) ?? arabic.date,
  );
  const arabicRows = new Map(
    z
      .array(arabicRow)
      .parse(arabic.db.query("select * from hadeeths where current = 1").all())
      .map((row) => [row.id, row]),
  );
  const links = z
    .array(link)
    .parse(arabic.db.query("select category_id, hadeeth_id from category_hadeeth").all());
  const categoriesOf = groupBy(links, (row) => row.hadeeth_id);
  const translated = new Map<string, Map<number, z.infer<typeof translatedRow>>>();
  const categoryTitles = new Map<number, { parentId: number; titles: Map<string, string> }>();
  for (const entry of opened) {
    for (const row of z
      .array(categoryRow)
      .parse(entry.db.query("select id, title, parent_id from categories").all())) {
      const known = categoryTitles.get(row.id) ?? { parentId: row.parent_id, titles: new Map() };
      known.titles.set(entry.code, row.title);
      categoryTitles.set(row.id, known);
    }
    if (entry.code === "ar") continue;
    translated.set(
      entry.code,
      new Map(
        z
          .array(translatedRow)
          .parse(
            entry.db
              .query(
                "select id, title, hadeeth, explanation, hints, grade, attribution, hadeeth_ar, ar_version from hadeeths",
              )
              .all(),
          )
          .map((row) => [row.id, row]),
      ),
    );
  }
  const orphans = [...translated.values()].flatMap((rows) =>
    [...rows.keys()].filter((id) => !arabicRows.has(id)),
  );
  if (orphans.length > 0)
    throw new Error(`translations without an Arabic original: ${orphans.length}`);
  let outdated = 0;
  const files = [...arabicRows.values()].map((row): CuratedFile => {
    const translations = Object.fromEntries(
      [...translated].flatMap(([code, rows]) => {
        const found = rows.get(row.id);
        if (!found) return [];
        if (found.ar_version < row.version) outdated++;
        return [
          [
            code,
            {
              title: found.title,
              hadeeth: found.hadeeth,
              explanation: found.explanation,
              hints: found.hints,
              grade: found.grade,
              attribution: found.attribution,
              translatedArabic: found.hadeeth_ar,
              arabicVersion: found.ar_version,
              released: dates.get(code) ?? arabic.date,
            },
          ],
        ];
      }),
    );
    return {
      data: {
        id: row.id,
        categories: (categoriesOf.get(row.id) ?? []).map((entry) => entry.category_id),
        arabic: {
          title: row.title,
          hadeeth: row.hadeeth,
          explanation: row.explanation,
          hints: row.hints,
          wordsMeanings: wordsMeanings.parse(JSON.parse(row.words_meanings || "[]")),
          grade: row.grade,
          attribution: row.attribution,
          reference: row.reference,
          version: row.version,
          released: arabic.date,
        },
        languages: Object.keys(translations),
        translations,
      },
      sources: [source],
    };
  });
  await mapLimit(files, 16, (file) => output.json(`hadith/curated/${file.data.id}.json`, file));
  await output.json("hadith/curated/categories.json", {
    data: [...categoryTitles].map(([id, { parentId, titles }]) => ({
      id,
      parentId,
      titles: Object.fromEntries(titles),
    })),
    sources: [source],
  });
  for (const entry of opened) entry.db.close();
  return {
    files,
    source,
    outdated,
    languages: opened.map(({ code, native, date }): CuratedLanguage => ({ code, native, date })),
  };
};
