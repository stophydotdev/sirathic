import type { Metadata } from "next";
import { loadBooks } from "@/lib/server-api";
import { alternatesOf } from "@/lib/seo";
import { translator } from "../../dictionaries";
import { Collection } from "./collection";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/hadith/[collection]">): Promise<Metadata> {
  const { lang, collection } = await params;
  const { locale, t } = await translator(lang);
  const data = await loadBooks(collection);
  const alternates = alternatesOf(locale, `/hadith/${collection}`, ["en"]);
  if (!data) return { title: t("Hadith"), alternates };
  return {
    title: data.collection.nameEn,
    description: t("{collection}, book by book, in Arabic and English.", {
      collection: data.collection.nameEn,
    }),
    alternates,
  };
}

export default async function CollectionPage({
  params,
}: PageProps<"/[lang]/hadith/[collection]">) {
  const { collection } = await params;
  return (
    <Collection collection={collection} data={await loadBooks(collection)} />
  );
}
