import type { Metadata } from "next";
import { loadQuranIndex } from "@/lib/server-api";
import { alternatesOf, INDEXED_QURAN_LOCALES } from "@/lib/seo";
import { translator } from "../dictionaries";
import { Quran } from "./quran";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/quran">): Promise<Metadata> {
  const { locale, t } = await translator((await params).lang);
  return {
    title: t("Quran"),
    description: t(
      "All 114 surahs of the Quran in Arabic, with translation and tafsir.",
    ),
    alternates: alternatesOf(locale, "/quran", INDEXED_QURAN_LOCALES),
  };
}

export default async function QuranPage() {
  return <Quran index={await loadQuranIndex()} />;
}
