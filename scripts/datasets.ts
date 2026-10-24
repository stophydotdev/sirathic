import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import {
  DATA_DIR,
  HADITH_COMMIT,
  HADITHS_PER_BOOK,
  MOKHTASAR_LANGUAGES,
  WIKISOURCE_BOOKS,
} from "./catalog";
import { tazkirulQuran } from "./tazkirul";
import { wikisourceBook } from "./wikisource";

const QURAN_VERSES = 6236;
const QURAN_SURAHS = 114;
const TAZKIRUL_VERSES = 6143;
const HADEETHENC_HADITHS = 2328;
const HADEETHENC_CATEGORIES = 452;
const POLITE_REQUESTS = 4;
const QURANENC = "https://quranenc.com/api/v1";
const HADEETHENC = "https://hadeethenc.com/api/v1";

const edition = z.object({
  hadiths: z.array(z.object({ hadithnumber: z.number() })),
});
const info = z.record(z.string(), edition);

const quranEncList = z.object({
  translations: z.array(z.object({ key: z.string(), version: z.string() })),
});
const quranEncVerse = z.looseObject({
  sura: z.string(),
  aya: z.string(),
  translation: z.string(),
});
const quranEncSura = z.object({ result: z.array(quranEncVerse) });
const quranEncFile = z.object({ verses: z.array(quranEncVerse) });

const hadeethEncRoots = z.array(z.object({ id: z.string() }));
const hadeethEncPage = z.object({
  meta: z.object({ last_page: z.coerce.number() }),
  data: z.array(z.object({ id: z.string() })),
});
const hadeethEncHadith = z.looseObject({ id: z.string() });
const hadeethEncCategories = z.array(z.looseObject({ id: z.string() }));
const hadeethEncFile = z.array(hadeethEncHadith);
const wikisourceFile = z.object({ hadiths: z.array(z.unknown()) });
const tazkirulFile = z.array(z.object({ surah: z.number(), from: z.number(), to: z.number() }));

type Dataset = {
  path: string;
  body: () => Promise<string>;
  count: (body: string) => number;
  expected: number;
};

const verseLines = (body: string) => body.match(/^\d+\|\d+\|/gmu)?.length ?? 0;

const surahTags = (body: string) => body.match(/<sura /gu)?.length ?? 0;

const coveredVerses = (body: string) =>
  new Set(
    tazkirulFile
      .parse(JSON.parse(body))
      .flatMap(({ surah, from, to }) =>
        Array.from({ length: to - from + 1 }, (_, index) => `${surah}:${from + index}`),
      ),
  ).size;

const editionHadiths = (body: string) => edition.parse(JSON.parse(body)).hadiths.length;

const infoHadiths = (body: string) =>
  Object.values(info.parse(JSON.parse(body))).reduce((sum, book) => sum + book.hadiths.length, 0);

const tanzilText = (type: string) =>
  `https://tanzil.net/pub/download/index.php?quranType=${type}&outType=txt-2&agree=true`;

const hadithApi = (file: string) =>
  `https://raw.githubusercontent.com/fawazahmed0/hadith-api/${HADITH_COMMIT}/${file}`;

const download = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered HTTP ${response.status}`);
  return response.text();
};

const downloadJson = async <Schema extends z.ZodType>(url: string, schema: Schema) =>
  schema.parse(JSON.parse(await download(url)));

const politely = async <Item, Result>(
  items: Item[],
  run: (item: Item) => Promise<Result>,
): Promise<Awaited<Result>[]> => {
  if (items.length === 0) return [];
  const batch = await Promise.all(items.slice(0, POLITE_REQUESTS).map(run));
  return batch.concat(await politely(items.slice(POLITE_REQUESTS), run));
};

const quranEnc = async (key: string) => {
  const [list, suras] = await Promise.all([
    downloadJson(`${QURANENC}/translations/list`, quranEncList),
    politely(
      Array.from({ length: QURAN_SURAHS }, (_, index) => index + 1),
      (sura) => downloadJson(`${QURANENC}/translation/sura/${key}/${sura}`, quranEncSura),
    ),
  ]);
  return JSON.stringify({
    key,
    version: list.translations.find((translation) => translation.key === key)?.version ?? null,
    verses: suras.flatMap((sura) => sura.result),
  });
};

const hadeethEnc = async () => {
  const roots = await downloadJson(`${HADEETHENC}/categories/roots/?language=en`, hadeethEncRoots);
  const page = (category: string, number: number) =>
    downloadJson(
      `${HADEETHENC}/hadeeths/list/?language=en&category_id=${category}&page=${number}&per_page=500`,
      hadeethEncPage,
    );
  const listed = await politely(roots, async ({ id }) => {
    const first = await page(id, 1);
    const rest = await politely(
      Array.from({ length: first.meta.last_page - 1 }, (_, index) => index + 2),
      (number) => page(id, number),
    );
    return [first, ...rest].flatMap(({ data }) => data.map((row) => row.id));
  });
  const ids = [...new Set(listed.flat())];
  const hadiths = await politely(ids, (id) =>
    downloadJson(`${HADEETHENC}/hadeeths/one/?language=en&id=${id}`, hadeethEncHadith),
  );
  return JSON.stringify(hadiths);
};

const DATASETS: Dataset[] = [
  {
    path: "quran/uthmani.txt",
    body: () => download(tanzilText("uthmani")),
    count: verseLines,
    expected: QURAN_VERSES,
  },
  {
    path: "quran/simple-clean.txt",
    body: () => download(tanzilText("simple-clean")),
    count: verseLines,
    expected: QURAN_VERSES,
  },
  {
    path: "quran/quran-data.xml",
    body: () => download("https://tanzil.net/res/text/metadata/quran-data.xml"),
    count: surahTags,
    expected: QURAN_SURAHS,
  },
  ...[
    "english_saheeh",
    "arabic_moyassar",
    ...MOKHTASAR_LANGUAGES.map(([language]) => `${language}_mokhtasar`),
  ].map((key) => ({
    path: `quranenc/${key}.json`,
    body: () => quranEnc(key),
    count: (body: string) => quranEncFile.parse(JSON.parse(body)).verses.length,
    expected: QURAN_VERSES,
  })),
  {
    path: "cps/tazkirul_quran.json",
    body: tazkirulQuran,
    count: coveredVerses,
    expected: TAZKIRUL_VERSES,
  },
  {
    path: "hadeethenc/en.json",
    body: hadeethEnc,
    count: (body) => hadeethEncFile.parse(JSON.parse(body)).length,
    expected: HADEETHENC_HADITHS,
  },
  {
    path: "hadeethenc/categories.json",
    body: () => download(`${HADEETHENC}/categories/list/?language=en`),
    count: (body) => hadeethEncCategories.parse(JSON.parse(body)).length,
    expected: HADEETHENC_CATEGORIES,
  },
  {
    path: "hadith/info.json",
    body: () => download(hadithApi("info.min.json")),
    count: infoHadiths,
    expected: Object.values(HADITHS_PER_BOOK).reduce((a, b) => a + b, 0),
  },
  ...Object.entries(WIKISOURCE_BOOKS).map(([book, { title, hadiths }]) => ({
    path: `wikisource/${book}.json`,
    body: () => wikisourceBook(title),
    count: (body: string) => wikisourceFile.parse(JSON.parse(body)).hadiths.length,
    expected: hadiths,
  })),
  ...Object.entries(HADITHS_PER_BOOK).flatMap(([book, expected]) =>
    ["ara", "eng"].map((language) => ({
      path: `hadith/${language}-${book}.json`,
      body: () => download(hadithApi(`editions/${language}-${book}.min.json`)),
      count: editionHadiths,
      expected,
    })),
  ),
];

const verify = async (dataset: Dataset) => {
  const path = `${DATA_DIR}/${dataset.path}`;
  const onDisk = existsSync(path);
  const body = onDisk ? await readFile(path, "utf8") : await dataset.body();
  const count = dataset.count(body);
  if (!onDisk && count === dataset.expected) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }
  return { ...dataset, count, onDisk };
};

const only = process.argv[2] ?? "";
const outcomes = await Promise.all(
  DATASETS.filter((dataset) => dataset.path.startsWith(only)).map(verify),
);

for (const { path, count, expected, onDisk } of outcomes) {
  const status = count === expected ? "ok" : "MISMATCH";
  const source = onDisk ? "already on disk" : "downloaded";
  console.log(`${status.padEnd(9)}${path.padEnd(34)}${`${count}/${expected}`.padEnd(13)}${source}`);
}

const mismatches = outcomes.filter(({ count, expected }) => count !== expected);
if (mismatches.length > 0) {
  console.error(
    `\n${mismatches.length} file(s) failed the count check. Downloads that failed were not saved; delete any failing file already on disk and run again.`,
  );
  process.exit(1);
}
console.log(`\n${outcomes.length} files verified in data/`);
