import { z } from "zod";
import bleedingWudu from "./bleedingWudu";
import camelMeatWudu from "./camelMeatWudu";
import { article } from "./schema";
import touchingWudu from "./touchingWudu";
import { written } from "./written";

const parsed = z.array(article).parse([touchingWudu, bleedingWudu, camelMeatWudu, ...written]);

const slugs = new Set(parsed.map((found) => found.slug));
if (slugs.size !== parsed.length) throw new Error("Discover articles share a slug");
for (const found of parsed) {
  for (const slug of found.related) {
    if (!slugs.has(slug)) throw new Error(`${found.slug} relates to a missing article: ${slug}`);
  }
}

export const articles = parsed.toSorted((a, b) => b.updated.localeCompare(a.updated));

export const articleOf = (slug: string) => articles.find((found) => found.slug === slug);
