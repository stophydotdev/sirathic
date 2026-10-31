import { z } from "zod";
import { article } from "./schema";

const parsed = z.array(article).parse([]);

const slugs = new Set(parsed.map((found) => found.slug));
if (slugs.size !== parsed.length) throw new Error("Discover articles share a slug");
for (const found of parsed) {
  for (const slug of found.related) {
    if (!slugs.has(slug)) throw new Error(`${found.slug} relates to a missing article: ${slug}`);
  }
}

export const articles = parsed.toSorted((a, b) => b.updated.localeCompare(a.updated));

export const articleOf = (slug: string) => articles.find((found) => found.slug === slug);
