import { z } from "zod";

const OPEN_DATA = "https://api.sirathic.com/v1";
const WAIT_MS = 3_000;
const FOOTNOTE_MARK = /\[\d+\]|\(\d+\)|[*\u00b9\u00b2\u00b3\u2070-\u2079]/gu;

const translationList = z.object({
  data: z.array(
    z.object({ key: z.string(), language: z.string(), title: z.string(), version: z.string() }),
  ),
});

const surahTranslation = z.object({
  data: z.object({
    verses: z.array(z.object({ ayah: z.number(), translation: z.string() })),
  }),
});

const openData = async <Schema extends z.ZodType>(path: string, schema: Schema) => {
  const res = await fetch(`${OPEN_DATA}${path}`, { signal: AbortSignal.timeout(WAIT_MS) });
  if (!res.ok) throw new Error(`open data answered ${res.status} for ${path}`);
  return schema.parse(await res.json());
};

export const quranTranslation = async (language: string, surah: number) => {
  const { data: listed } = await openData("/quran/translations", translationList);
  const chosen = listed.find((translation) => translation.language === language);
  if (!chosen) throw new Error("none published in this language");
  const { data } = await openData(`/quran/translations/${chosen.key}/${surah}`, surahTranslation);
  return {
    by: `${chosen.title}, version ${chosen.version}, from QuranEnc.com`,
    verses: new Map(
      data.verses.map(({ ayah, translation }) => [
        ayah,
        translation.replace(FOOTNOTE_MARK, "").trim(),
      ]),
    ),
  };
};
