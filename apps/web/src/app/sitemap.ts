import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

const updated = new Date("2026-10-24");

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/download"].map((path) => ({ url: `${SITE}${path}`, lastModified: updated }));
}
