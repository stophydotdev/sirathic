import { z } from "zod";

export const RUNS = `${import.meta.dirname}/../../../data/bench`;

const kind = z.enum(["islamic", "general"]);

const links = z.array(z.object({ number: z.number(), url: z.string() }));

const questionList = z.array(
  z.object({
    kind,
    question: z.string(),
    set: z.enum(["fiqhqa", "reddit", "quote"]).optional(),
    schools: z
      .object({
        hanafi: z.string(),
        maliki: z.string(),
        shafii: z.string(),
        hanbali: z.string(),
      })
      .optional(),
  }),
);

const answerRow = z.object({
  kind,
  question: z.string(),
  text: z.string().optional(),
  links: links.optional(),
  error: z.string().optional(),
  calls: z.array(z.string()).optional(),
  searches: z
    .array(
      z.object({
        input: z.unknown(),
        found: z.record(z.string(), z.array(z.string())),
      }),
    )
    .optional(),
  searchSeconds: z.number().optional(),
  firstText: z.number().optional(),
  total: z.number().optional(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  toolTokens: z.number().optional(),
  words: z.number().optional(),
  cites: z.number().optional(),
  sources: z
    .array(
      z.object({
        kind: z.string(),
        rank: z.number(),
        number: z.number(),
        cited: z.boolean(),
      }),
    )
    .optional(),
});

export type RunRow = z.infer<typeof answerRow>;

const perplexityAnswer = z.object({
  kind,
  preset: z.string(),
  question: z.string(),
  seconds: z.number(),
  text: z.string(),
  sources: links.optional(),
  usage: z
    .object({ input_tokens: z.number(), output_tokens: z.number() })
    .optional(),
  cost: z.number().optional(),
});

export type PerplexityAnswer = z.infer<typeof perplexityAnswer>;

export const PERPLEXITY = `${import.meta.dirname}/perplexity.json`;

export const readRun = async (name: string) =>
  z.array(answerRow).parse(await Bun.file(`${RUNS}/${name}.json`).json());

export const readQuestions = async () =>
  questionList.parse(
    await Bun.file(`${import.meta.dirname}/questions.json`).json(),
  );

export const readPerplexity = async () =>
  z.array(perplexityAnswer).parse(await Bun.file(PERPLEXITY).json());

export const median = (values: number[]) => {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0
      ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
      : (sorted[middle] ?? 0);
  return Math.round(value * 100) / 100;
};
