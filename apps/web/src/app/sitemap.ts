import type { MetadataRoute } from "next";
import { articles } from "@/content/discover/articles";
import { SITE } from "@/lib/seo";

const updated = new Date("2026-10-24");

export default function sitemap(): MetadataRoute.Sitemap {
  const [latest] = articles;
  return [
    ...["", "/download"].map((path) => ({ url: `${SITE}${path}`, lastModified: updated })),
    ...(latest ? [{ url: `${SITE}/discover`, lastModified: latest.updated }] : []),
    ...articles.map(({ slug, updated: modified }) => ({
      url: `${SITE}/discover/${slug}`,
      lastModified: modified,
    })),
  ];
}
