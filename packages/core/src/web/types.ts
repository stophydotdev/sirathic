import { z } from "zod";

export const webSearchResult = z.object({
  url: z.string(),
  title: z.string(),
  description: z.string(),
  markdown: z.string().optional(),
});

export const webFetchResult = z.object({
  url: z.string(),
  title: z.string(),
  markdown: z.string(),
  statusCode: z.number(),
});

export type WebSearchResult = z.infer<typeof webSearchResult>;
export type WebFetchResult = z.infer<typeof webFetchResult>;
