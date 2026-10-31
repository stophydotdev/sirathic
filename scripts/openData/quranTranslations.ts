import { z } from "zod";
import type { translationVerse } from "../../apps/data/src/schema";
import { mapLimit } from "./util";
import { download, fetchJson, quranEncSource } from "./sources";

const listing = z.object({
  translations: z.array(
    z.object({
      key: z.string(),
      direction: z.string(),
      language_iso_code: z.string(),
      version: z.string(),
      last_update: z.number(),
      title: z.string(),
      description: z.string(),
    }),
  ),
});

const suraResponse = z.object({
  result: z.array(
    z.object({
      sura: z.coerce.number(),
      aya: z.coerce.number(),
      translation: z.string(),
      footnotes: z.string().nullable(),
    }),
  ),
});

type Row = z.infer<typeof translationVerse>;

const suraUrl = (key: string, surah: number) =>
  `https://quranenc.com/api/v1/translation/sura/${key}/${surah}`;

export const loadTranslations = async (rawDir: string, ayahCounts: number[]) => {
  const { translations } = await fetchJson(
    "https://quranenc.com/api/v1/translations/list",
    listing,
  );
  const jobs = translations.flatMap(({ key, version }) =>
    ayahCounts.map((_, index) => ({ key, version, surah: index + 1 })),
  );
  const paths = await mapLimit(jobs, 8, ({ key, version, surah }) =>
    download(suraUrl(key, surah), `${rawDir}/quranenc/${key}-${version}/${surah}.json`),
  );
  const loaded = await Promise.all(
    jobs.map(async (job, index) => {
      const path = paths[index];
      if (!path) throw new Error(`missing download for ${job.key} ${job.surah}`);
      const { result } = suraResponse.parse(await Bun.file(path).json());
      const verses = result
        .filter((row) => row.sura === job.surah)
        .map((row): Row => ({
          ayah: row.aya,
          translation: row.translation,
          footnotes: row.footnotes,
        }))
        .toSorted((a, b) => a.ayah - b.ayah);
      const have = new Set(verses.map((row) => row.ayah));
      const expected = Array.from(
        { length: ayahCounts[job.surah - 1] ?? 0 },
        (_, ayah) => ayah + 1,
      );
      return { job, verses, missing: expected.filter((ayah) => !have.has(ayah)).length };
    }),
  );
  const rows = new Map(loaded.map(({ job, verses }) => [`${job.key}/${job.surah}`, verses]));
  return {
    translations: translations.map((translation) => ({
      key: translation.key,
      language: translation.language_iso_code,
      direction: translation.direction,
      title: translation.title,
      description: translation.description,
      version: translation.version,
      lastUpdate: new Date(translation.last_update * 1000).toISOString(),
      source: quranEncSource(translation),
      missingAyahs: loaded
        .filter(({ job }) => job.key === translation.key)
        .reduce((total, { missing }) => total + missing, 0),
    })),
    rows,
  };
};
