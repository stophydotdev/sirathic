import type { Metadata } from "next";
import { Chat } from "@/components/chat";
import { LOCALES } from "@/components/locales";
import { alternatesOf } from "@/lib/seo";
import { translator } from "./dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { locale, t } = await translator((await params).lang);
  return {
    description: t(
      "Free Islamic answering engine. Answers come from the Quran, graded hadith and scholars' rulings, and cite their sources.",
    ),
    alternates: alternatesOf(locale, "", LOCALES),
  };
}

export default function Home() {
  return <Chat />;
}
