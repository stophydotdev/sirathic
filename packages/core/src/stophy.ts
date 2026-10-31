import { env } from "@sirathic/env/server";
import { Stophy } from "stophy";
import { z } from "zod";

export const stophy = new Stophy({ apiKey: env.STOPHY_API_KEY });

export const scrapedPage = z.object({
  markdown: z.string().optional(),
  rawHtml: z.string().optional(),
  metadata: z.object({
    title: z.string().optional(),
    sourceURL: z.string().optional(),
    statusCode: z.number(),
  }),
});

export const clip = (text: string | null | undefined, chars: number) =>
  (text ?? "").replaceAll(/\s+/gu, " ").trim().slice(0, chars);
