import { z } from "zod";

export const source = z.object({
  url: z.string(),
  title: z.string(),
  snippet: z.string(),
  credit: z.string().optional(),
});

export type Source = z.infer<typeof source>;
