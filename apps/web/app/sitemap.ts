import type { MetadataRoute } from "next";
import { LOCALES, type Locale } from "@/components/locales";
import { languagesOf, SITE } from "@/lib/seo";

const pages = (path: string, locales: readonly Locale[]) =>
  locales.map((locale) => ({
    url: `${SITE}/${locale}${path}`,
    alternates: { languages: languagesOf(path, locales) },
  }));

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/download"].flatMap((path) => pages(path, LOCALES));
}
