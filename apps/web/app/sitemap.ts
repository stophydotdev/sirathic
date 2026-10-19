import type { MetadataRoute } from "next";
import { LOCALES, type Locale } from "@/components/locales";
import { loadBooks, loadCollections } from "@/lib/server-api";
import { INDEXED_QURAN_LOCALES, languagesOf, SITE } from "@/lib/seo";

const pages = (path: string, locales: readonly Locale[]) =>
  locales.map((locale) => ({
    url: `${SITE}/${locale}${path}`,
    alternates: { languages: languagesOf(path, locales) },
  }));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const collections = await Promise.all(
    ((await loadCollections()) ?? []).map(async ({ id }) => ({
      id,
      books: (await loadBooks(id))?.books ?? [],
    })),
  );
  const quranPaths = [
    "/quran",
    ...Array.from({ length: 114 }, (_, index) => `/quran/${index + 1}`),
  ];
  const hadithPaths = [
    "/hadith",
    ...collections.map(({ id }) => `/hadith/${id}`),
    ...collections.flatMap(({ id, books }) =>
      books.map((book) => `/hadith/${id}/${book.number}`),
    ),
  ];
  return [
    ...["", "/download"].flatMap((path) => pages(path, LOCALES)),
    ...quranPaths.flatMap((path) => pages(path, INDEXED_QURAN_LOCALES)),
    ...hadithPaths.flatMap((path) => pages(path, ["en"])),
  ];
}
