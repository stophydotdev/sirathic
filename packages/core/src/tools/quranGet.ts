import { db } from "@sirathic/db";
import { surahs, tafsirPassages, texts, verses } from "@sirathic/db/schema";
import { and, asc, between, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { quranTranslation } from "./quranTranslation";

const MAX_VERSES = 50;

const LONGEST_SURAH = 286;

export const quranGetInput = z
  .object({
    surah: z.number().int().min(1).max(114),
    from: z.number().int().min(1).max(LONGEST_SURAH).optional(),
    to: z.number().int().min(1).max(LONGEST_SURAH).optional(),
    context: z.number().int().min(0).max(10).default(0),
    language: z
      .string()
      .optional()
      .describe(
        "The language you are answering in, as an ISO 639 code like fr, ur or id. When it is not en, each verse also comes with a published translation in that language: quote it word for word and name the translation.",
      ),
  })
  .refine(({ from, to }) => to === undefined || (from !== undefined && to >= from), {
    message: "to needs from, and must not be before it",
  });

const verseColumns = {
  id: verses.id,
  surah: verses.surah,
  surahName: surahs.nameTranslit,
  ayah: verses.ayah,
  textAr: verses.textAr,
  textEn: sql<string>`regexp_replace(${verses.textEn}, '\\[[0-9]+\\]', '', 'g')`,
  footnotesEn: verses.footnotesEn,
  tafsirAr: texts.body,
};

const selectVerses = () =>
  db
    .select(verseColumns)
    .from(verses)
    .innerJoin(surahs, eq(verses.surah, surahs.number))
    .leftJoin(texts, and(eq(texts.ref, verses.id), eq(texts.source, "quranenc-arabic_moyassar")));

export const tafsirEnFor = async (verseIds: string[]) => {
  if (verseIds.length === 0) return [];
  const rows = await db
    .selectDistinct({
      surah: tafsirPassages.surah,
      fromAyah: tafsirPassages.fromAyah,
      toAyah: tafsirPassages.toAyah,
      text: tafsirPassages.body,
    })
    .from(tafsirPassages)
    .innerJoin(
      verses,
      and(
        eq(verses.surah, tafsirPassages.surah),
        between(verses.ayah, tafsirPassages.fromAyah, tafsirPassages.toAyah),
      ),
    )
    .where(and(eq(tafsirPassages.source, "cps-tazkirul_quran"), inArray(verses.id, verseIds)))
    .orderBy(asc(tafsirPassages.surah), asc(tafsirPassages.fromAyah));
  return rows.map(({ surah, fromAyah, toAyah, text }) => ({
    verses: fromAyah === toAyah ? `${surah}:${fromAyah}` : `${surah}:${fromAyah}-${toAyah}`,
    text,
  }));
};

export const versesByIds = async (ids: string[]) => {
  if (ids.length === 0) return [];
  const rows = await selectVerses().where(inArray(verses.id, ids));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => byId.get(id) ?? []);
};

export const quranGet = async (input: z.input<typeof quranGetInput>) => {
  const { surah, from, to = from, context, language } = quranGetInput.parse(input);
  const code = language?.toLowerCase().split(/[-_]/u)[0];
  const translating =
    code === undefined || code === "en" || code === "ar"
      ? undefined
      : quranTranslation(code, surah).catch((err: Error) => {
          console.warn(`no ${code} Quran translation: ${err.message}`);
          return undefined;
        });
  const window =
    from === undefined || to === undefined
      ? undefined
      : between(verses.ayah, Math.max(1, from - context), to + context);
  const rows = await selectVerses()
    .where(and(eq(verses.surah, surah), window))
    .orderBy(asc(verses.ayah))
    .limit(MAX_VERSES + 1);
  const shown = rows.slice(0, MAX_VERSES);
  const translated = await translating;
  return {
    truncated: rows.length > MAX_VERSES,
    translatedBy: translated?.by,
    tafsirEn: await tafsirEnFor(shown.map((row) => row.id)),
    verses: shown.map((row) =>
      Object.assign(row, {
        isContext: from !== undefined && to !== undefined && (row.ayah < from || row.ayah > to),
        translation: translated?.verses.get(row.ayah),
      }),
    ),
  };
};
