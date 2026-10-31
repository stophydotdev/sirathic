import { z } from "zod";

const source = z.object({ url: z.url(), title: z.string().min(1) });

const paragraph = z.object({
  text: z.string().min(1),
  citations: z.array(z.url()).min(1),
});

const verse = z.object({
  arabic: z.string().min(1),
  translation: z.string().min(1),
  reference: z.string().min(1),
  url: z.url(),
});

const section = z.object({
  heading: z.string().min(1),
  paragraphs: z.array(paragraph).min(1),
});

export const article = z
  .object({
    title: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    topic: z.string().min(1),
    summary: paragraph,
    updated: z.iso.date(),
    reviewed: z.boolean(),
    sources: z.array(source).min(1),
    verse: verse.optional(),
    sections: z.array(section).min(1),
    related: z.array(z.string()),
  })
  .superRefine((found, context) => {
    const listed = new Set(found.sources.map((entry) => entry.url));
    const cited = new Set([
      ...(found.verse ? [found.verse.url] : []),
      ...[found.summary, ...found.sections.flatMap((entry) => entry.paragraphs)].flatMap(
        (entry) => entry.citations,
      ),
    ]);
    for (const url of cited) {
      if (!listed.has(url))
        context.addIssue({ code: "custom", message: `${url} is not in sources` });
    }
    for (const url of listed) {
      if (!cited.has(url)) context.addIssue({ code: "custom", message: `${url} is never cited` });
    }
  });

export type Article = z.infer<typeof article>;

export type ArticleInput = z.input<typeof article>;
