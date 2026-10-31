import { Database } from "bun:sqlite";
import { rmSync } from "node:fs";
import type { Source } from "../../apps/data/src/schema";
import type { buildCurated } from "./curated";
import type { buildHadith } from "./hadith";
import type { Output } from "./output";
import type { buildQuran } from "./quran";

type Quran = Awaited<ReturnType<typeof buildQuran>>;
type Hadith = Awaited<ReturnType<typeof buildHadith>>;
type Curated = Awaited<ReturnType<typeof buildCurated>>;

type Cell = string | number | null;

const fill = (db: Database, name: string, columns: string[], rows: Cell[][]) => {
  db.run(`create table ${name} (${columns.join(", ")})`);
  const insert = db.prepare(`insert into ${name} values (${columns.map(() => "?").join(", ")})`);
  db.transaction(() => {
    for (const row of rows) insert.run(...row);
  })();
};

const fillSources = (db: Database, sources: Source[]) =>
  fill(
    db,
    "sources",
    [
      "id text",
      "name text",
      "url text",
      "license text",
      "license_url text",
      "version text",
      "attribution text",
    ],
    sources.map((s) => [s.id, s.name, s.url, s.license, s.licenseUrl, s.version, s.attribution]),
  );

const createDatabase = (output: Output, name: string, fillTables: (db: Database) => void) => {
  rmSync(`${output.dir}/downloads/${name}`, { force: true });
  const db = new Database(output.path(`downloads/${name}`), { create: true });
  fillTables(db);
  db.run("vacuum");
  db.close();
};

const sha256Of = async (path: string) => {
  const hasher = new Bun.CryptoHasher("sha256");
  for await (const chunk of Bun.file(path).stream()) hasher.update(chunk);
  return hasher.digest("hex");
};

const unique = (sources: Source[]) => [...new Map(sources.map((s) => [s.id, s])).values()];

export const buildDownloads = async (
  output: Output,
  quran: Quran,
  hadith: Hadith,
  curated: Curated,
) => {
  const quranSources = [quran.tanzil.source, ...quran.translations.map((t) => t.source)];
  const hadithSources = hadith.sources;
  const entries: { name: string; dataset: string; description: string; sources: Source[] }[] = [];
  const writes: Promise<number>[] = [];
  const add = (name: string, dataset: string, description: string, sources: Source[]) =>
    entries.push({ name, dataset, description, sources });

  createDatabase(output, "quran.sqlite", (db) => {
    fillSources(db, quranSources);
    fill(
      db,
      "notices",
      ["source text", "notice text"],
      quran.tanzil.notices.map((notice) => ["tanzil", notice]),
    );
    fill(
      db,
      "surahs",
      [
        "number integer",
        "name text",
        "transliteration text",
        "english_name text",
        "revelation text",
        "ayahs integer",
      ],
      quran.surahFiles.map(({ data }) => [
        data.number,
        data.name,
        data.transliteration,
        data.englishName,
        data.revelation,
        data.ayahs,
      ]),
    );
    fill(
      db,
      "verses",
      [
        "surah integer",
        "ayah integer",
        "juz integer",
        "page integer",
        "hizb integer",
        "quarter integer",
        "sajda text",
        "uthmani text",
        "simple text",
      ],
      quran.tanzil.verses.map((v) => [
        v.surah,
        v.ayah,
        v.juz,
        v.page,
        v.hizb,
        v.quarter,
        v.sajda,
        v.arabic.uthmani,
        v.arabic.simple,
      ]),
    );
    fill(
      db,
      "translations",
      ["key text", "language text", "title text", "version text", "source_id text"],
      quran.translations.map((t) => [t.key, t.language, t.title, t.version, t.source.id]),
    );
    fill(
      db,
      "translation_verses",
      ["key text", "surah integer", "ayah integer", "translation text", "footnotes text"],
      quran.translationFiles.flatMap(({ data }) =>
        data.verses.map((v) => [data.key, data.surah, v.ayah, v.translation, v.footnotes]),
      ),
    );
  });
  add(
    "quran.sqlite",
    "quran",
    "Quran text (Tanzil) and every QuranEnc translation, with sources and licenses",
    quranSources,
  );

  writes.push(
    output.json("downloads/quran.json", {
      sources: [quran.tanzil.source],
      notice: quran.tanzil.notices.join("\n\n"),
      surahs: quran.surahFiles.map(({ data }) => ({
        number: data.number,
        name: data.name,
        transliteration: data.transliteration,
        englishName: data.englishName,
        revelation: data.revelation,
        ayahs: data.ayahs,
      })),
      verses: quran.tanzil.verses,
    }),
  );
  add("quran.json", "quran", "Quran text (Tanzil) with juz, page and hizb positions", [
    quran.tanzil.source,
  ]);

  for (const translation of quran.translations) {
    const files = quran.translationFiles.filter(({ data }) => data.key === translation.key);
    writes.push(
      output.json(`downloads/quran-translation-${translation.key}.json`, {
        sources: [translation.source],
        translation: {
          key: translation.key,
          language: translation.language,
          title: translation.title,
          version: translation.version,
        },
        verses: files.flatMap(({ data }) =>
          data.verses.map((v) => ({
            surah: data.surah,
            ayah: v.ayah,
            translation: v.translation,
            footnotes: v.footnotes,
          })),
        ),
      }),
    );
    add(`quran-translation-${translation.key}.json`, "quran-translation", translation.title, [
      translation.source,
    ]);
  }

  const records = [...hadith.recordsBySlug.values()].flat();
  createDatabase(output, "hadith.sqlite", (db) => {
    fillSources(db, hadithSources);
    fill(
      db,
      "hadith",
      [
        "collection text",
        "number text",
        "book integer",
        "hadith integer",
        "arabic text",
        "verified integer",
        "reason text",
        "similarity real",
      ],
      records.map((r) => [
        r.collection,
        r.number,
        r.inBook?.book ?? null,
        r.inBook?.hadith ?? null,
        r.arabic,
        r.verified ? 1 : 0,
        r.reason,
        r.similarity,
      ]),
    );
    fill(
      db,
      "grades",
      ["collection text", "number text", "grader text", "grade text"],
      records.flatMap((r) => r.grades.map((g) => [r.collection, r.number, g.name, g.grade])),
    );
    fill(
      db,
      "collections",
      ["slug text", "name text", "total integer", "verified integer"],
      hadith.summary.map((c) => [c.slug, c.name, c.total, c.verified]),
    );
  });
  add(
    "hadith.sqlite",
    "hadith",
    "Arabic hadith of ten collections with grades and the verified flag",
    hadithSources,
  );
  writes.push(
    output.json("downloads/hadith.json", {
      sources: hadithSources,
      collections: hadith.summary,
      hadith: records,
    }),
  );
  add(
    "hadith.json",
    "hadith",
    "Arabic hadith of ten collections with grades and the verified flag",
    hadithSources,
  );

  createDatabase(output, "curated.sqlite", (db) => {
    fillSources(db, [curated.source]);
    fill(
      db,
      "hadith",
      [
        "id integer",
        "title text",
        "hadeeth text",
        "explanation text",
        "hints text",
        "words_meanings text",
        "grade text",
        "attribution text",
        "reference text",
        "version integer",
        "released text",
      ],
      curated.files.map(({ data: d }) => [
        d.id,
        d.arabic.title,
        d.arabic.hadeeth,
        d.arabic.explanation,
        JSON.stringify(d.arabic.hints),
        JSON.stringify(d.arabic.wordsMeanings),
        d.arabic.grade,
        d.arabic.attribution,
        d.arabic.reference,
        d.arabic.version,
        d.arabic.released,
      ]),
    );
    fill(
      db,
      "translations",
      [
        "id integer",
        "language text",
        "title text",
        "hadeeth text",
        "explanation text",
        "hints text",
        "grade text",
        "attribution text",
        "translated_arabic text",
        "arabic_version integer",
        "released text",
      ],
      curated.files.flatMap(({ data: d }) =>
        Object.entries(d.translations).map(([code, t]) => [
          d.id,
          code,
          t.title,
          t.hadeeth,
          t.explanation,
          JSON.stringify(t.hints),
          t.grade,
          t.attribution,
          t.translatedArabic,
          t.arabicVersion,
          t.released,
        ]),
      ),
    );
    fill(
      db,
      "hadith_categories",
      ["hadith_id integer", "category_id integer"],
      curated.files.flatMap(({ data: d }) => d.categories.map((c) => [d.id, c])),
    );
  });
  add(
    "curated.sqlite",
    "curated",
    "HadeethEnc curated hadith in every language, with grades and explanations",
    [curated.source],
  );
  for (const { code } of curated.languages) {
    writes.push(
      output.json(`downloads/curated-${code}.json`, {
        sources: [curated.source],
        language: code,
        hadith: curated.files.flatMap(({ data: d }): object[] => {
          const translation = d.translations[code];
          if (code === "ar") return [{ id: d.id, categories: d.categories, ...d.arabic }];
          return translation ? [{ id: d.id, categories: d.categories, ...translation }] : [];
        }),
      }),
    );
    add(`curated-${code}.json`, "curated", `HadeethEnc curated hadith in ${code}`, [
      curated.source,
    ]);
  }

  await Promise.all(writes);
  const manifest = await Promise.all(
    entries.map(async (entry) => ({
      name: entry.name,
      url: `/v1/downloads/${entry.name}`,
      dataset: entry.dataset,
      description: entry.description,
      format: entry.name.endsWith(".sqlite") ? "sqlite" : "json",
      bytes: output.size(`downloads/${entry.name}`),
      sha256: await sha256Of(`${output.dir}/downloads/${entry.name}`),
      licenses: [...new Set(entry.sources.map((s) => s.license))],
      sources: entry.sources.map((s) => s.id),
    })),
  );
  await output.json("downloads.json", {
    data: manifest,
    sources: unique(entries.flatMap((e) => e.sources)),
  });
  return manifest;
};
