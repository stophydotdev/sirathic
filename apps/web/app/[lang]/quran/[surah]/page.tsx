import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reader } from "@/components/quran/reader";
import { loadSurah, loadTranslation } from "@/lib/server-api";
import {
  alternatesOf,
  INDEXED_QURAN_LOCALES,
  QURAN_TRANSLATION_OF_LOCALE,
} from "@/lib/seo";
import { translator } from "../../dictionaries";

const surahNumber = (surah: string) => {
  const number = Number(surah);
  return Number.isInteger(number) && number >= 1 && number <= 114
    ? number
    : notFound();
};

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/quran/[surah]">): Promise<Metadata> {
  const { lang, surah } = await params;
  const { locale, t } = await translator(lang);
  const number = surahNumber(surah);
  const text = await loadSurah(number);
  const alternates = alternatesOf(
    locale,
    `/quran/${number}`,
    INDEXED_QURAN_LOCALES,
  );
  if (!text) return { title: t("Quran"), alternates };
  const name = text.surah.nameTranslit;
  return {
    title: t("Surah {name} ({number}): Arabic, translation and tafsir", {
      name,
      number,
    }),
    description: t(
      "Surah {name} in Arabic, with translation and tafsir. {count} ayahs.",
      { name, count: text.surah.verseCount },
    ),
    alternates,
  };
}

export default async function SurahPage({
  params,
}: PageProps<"/[lang]/quran/[surah]">) {
  const { lang, surah } = await params;
  const { locale } = await translator(lang);
  const number = surahNumber(surah);
  const translation = QURAN_TRANSLATION_OF_LOCALE.get(locale);
  const [text, rows] = await Promise.all([
    loadSurah(number),
    translation === undefined
      ? undefined
      : loadTranslation(translation, number),
  ]);
  return (
    <Reader
      number={number}
      text={text}
      pageTranslation={
        translation === undefined || !rows
          ? undefined
          : { id: translation, rows }
      }
    />
  );
}
