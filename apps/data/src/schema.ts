import { z } from "zod";

const source = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  license: z.string(),
  licenseUrl: z.string(),
  version: z.string(),
  attribution: z.string(),
});

export type Source = z.infer<typeof source>;

const envelope = <Data extends z.ZodType>(data: Data) =>
  z.object({ data, sources: z.array(source) });

export const quranVerse = z.object({
  surah: z.number(),
  ayah: z.number(),
  juz: z.number(),
  page: z.number(),
  hizb: z.number(),
  quarter: z.number(),
  sajda: z.enum(["recommended", "obligatory"]).nullable(),
  arabic: z.object({ uthmani: z.string(), simple: z.string() }),
});

export const quranSurahFile = envelope(
  z.object({
    number: z.number(),
    name: z.string(),
    transliteration: z.string(),
    englishName: z.string(),
    revelation: z.enum(["Meccan", "Medinan"]),
    ayahs: z.number(),
    verses: z.array(quranVerse),
  }),
);

export const translationVerse = z.object({
  ayah: z.number(),
  translation: z.string(),
  footnotes: z.string().nullable(),
});

export const translationSurahFile = envelope(
  z.object({
    key: z.string(),
    language: z.string(),
    title: z.string(),
    version: z.string(),
    surah: z.number(),
    verses: z.array(translationVerse),
  }),
);

export const hadithReason = z.enum([
  "empty_arabic",
  "no_second_copy",
  "number_mismatch",
  "arabic_mismatch",
]);

export const hadithRecord = z.object({
  collection: z.string(),
  number: z.string(),
  inBook: z.object({ book: z.number(), hadith: z.number() }).nullable(),
  arabic: z.string(),
  grades: z.array(z.object({ name: z.string(), grade: z.string() })),
  verified: z.boolean(),
  reason: hadithReason.nullable(),
  similarity: z.number().nullable(),
});

export const hadithBlockFile = envelope(z.object({ hadith: z.array(hadithRecord) }));

export const aliasIndexFile = z.record(z.string(), z.string());

export const wordsMeanings = z.array(
  z.object({ word: z.string(), meaning: z.string().nullable() }),
);

const curatedArabic = z.object({
  title: z.string(),
  hadeeth: z.string(),
  explanation: z.string(),
  hints: z.array(z.string()),
  wordsMeanings,
  grade: z.string(),
  attribution: z.string(),
  reference: z.string(),
  version: z.number(),
  released: z.string(),
});

const curatedTranslation = z.object({
  title: z.string(),
  hadeeth: z.string(),
  explanation: z.string(),
  hints: z.array(z.string()),
  grade: z.string(),
  attribution: z.string(),
  arabicVersion: z.number(),
  released: z.string(),
});

export const curatedFile = envelope(
  z.object({
    id: z.number(),
    categories: z.array(z.number()),
    arabic: curatedArabic,
    languages: z.array(z.string()),
    translations: z.record(z.string(), curatedTranslation),
  }),
);
