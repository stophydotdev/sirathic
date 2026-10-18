import { z } from "zod";
import { clip, stophy } from "../stophy";

const TEXT_CHARS = 300;

export const newsSearchInput = z.object({
  query: z.string().trim().min(2).max(200),
  time: z.enum(["past24Hours", "pastWeek", "pastMonth", "pastYear"]).optional(),
  limit: z.number().int().min(1).max(20).default(8),
});

export const newsSearch = async (input: z.input<typeof newsSearchInput>) => {
  const { query, time, limit } = newsSearchInput.parse(input);
  const { data } = await stophy.google.news({ query, time });
  const articles = data.results.slice(0, limit).map((article) => ({
    url: article.url,
    title: article.title,
    source: article.source ?? null,
    description: clip(article.description, TEXT_CHARS),
    publishedAt: article.publishedAt ?? null,
  }));
  return { query, articles };
};
