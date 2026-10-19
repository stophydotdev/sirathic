import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadHadithPage } from "@/lib/server-api";
import { alternatesOf } from "@/lib/seo";
import { translator } from "../../../dictionaries";
import { Book } from "./book";

const bookNumber = (book: string) => {
  const number = Number(book);
  return Number.isInteger(number) && number >= 0 ? number : notFound();
};

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/hadith/[collection]/[book]">): Promise<Metadata> {
  const { lang, collection, book } = await params;
  const { locale, t } = await translator(lang);
  const number = bookNumber(book);
  const first = await loadHadithPage(collection, number);
  const alternates = alternatesOf(locale, `/hadith/${collection}/${number}`, [
    "en",
  ]);
  if (!first) return { title: t("Hadith"), alternates };
  const name =
    number === 0
      ? t("Other hadith")
      : (first.book.name ?? t("Book {number}", { number }));
  return {
    title: `${name} · ${first.collection.nameEn}`,
    description: t("{count} hadith from {collection}, in Arabic and English.", {
      count: first.book.hadiths,
      collection: first.collection.nameEn,
    }),
    alternates,
  };
}

export default async function BookPage({
  params,
}: PageProps<"/[lang]/hadith/[collection]/[book]">) {
  const { collection, book } = await params;
  const number = bookNumber(book);
  return (
    <Book
      collection={collection}
      book={number}
      first={await loadHadithPage(collection, number)}
    />
  );
}
