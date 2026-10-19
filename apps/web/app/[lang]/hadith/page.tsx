import type { Metadata } from "next";
import { loadCollections } from "@/lib/server-api";
import { alternatesOf } from "@/lib/seo";
import { translator } from "../dictionaries";
import { Hadith } from "./collections";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/hadith">): Promise<Metadata> {
  const { locale, t } = await translator((await params).lang);
  return {
    title: t("Hadith"),
    description: t(
      "Bukhari, Muslim and the other major hadith collections, in Arabic and English.",
    ),
    alternates: alternatesOf(locale, "/hadith", ["en"]),
  };
}

export default async function HadithPage() {
  return <Hadith collections={await loadCollections()} />;
}
