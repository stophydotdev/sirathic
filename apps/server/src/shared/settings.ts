import { z } from "zod";

export const MADHABS = ["none", "hanafi", "maliki", "shafii", "hanbali"] as const;
export const ANSWER_LANGUAGES = ["auto", "en", "ar", "fr", "ur", "id", "tr"] as const;
export const ANSWER_LENGTHS = ["short", "default", "detailed"] as const;
export const MEMORY_LIMIT = 20;
export const MEMORY_CHARS = 200;

export const settings = z.object({
  name: z.string().trim().max(80),
  madhab: z.enum(MADHABS),
  instructions: z.string().trim().max(1500),
  answerLanguage: z.enum(ANSWER_LANGUAGES),
  answerLength: z.enum(ANSWER_LENGTHS),
  showArabic: z.boolean(),
  memory: z.array(z.string().trim().min(1).max(MEMORY_CHARS)).max(MEMORY_LIMIT),
});

export const told = z.object({
  madhab: z.enum(MADHABS).nullable().describe("The school the user says they follow, or null"),
  answerLanguage: z
    .enum(ANSWER_LANGUAGES)
    .nullable()
    .describe("The language the user wants every answer in, or null"),
  answerLength: z
    .enum(ANSWER_LENGTHS)
    .nullable()
    .describe("How long the user wants answers to be, or null"),
  showArabic: z.boolean().nullable().describe("Whether the user wants Arabic text shown, or null"),
  fact: z
    .string()
    .nullable()
    .describe(
      "Lasting facts the user states about themselves that no other field holds, in under 15 words, or null",
    ),
  replaces: z
    .string()
    .nullable()
    .describe(
      "Only after a reply said memory is full: the exact text of the saved fact to swap out for this one, otherwise null",
    ),
});

export const settingsUpdate = settings.partial();

export type Settings = z.infer<typeof settings>;

export const DEFAULT_SETTINGS: Settings = {
  name: "",
  madhab: "none",
  instructions: "",
  answerLanguage: "auto",
  answerLength: "default",
  showArabic: true,
  memory: [],
};

export const memoryFact = (fact: string | null) => fact?.trim().slice(0, MEMORY_CHARS);

export const rememberedUpdate = (
  memory: readonly string[],
  { fact, replaces, ...preferences }: z.output<typeof told>,
): z.output<typeof settingsUpdate> => {
  const kept = memoryFact(fact);
  const swapped = replaces?.trim();
  const next = [...memory.filter((old) => old !== swapped), ...(kept ? [kept] : [])];
  return {
    ...(preferences.madhab !== null && { madhab: preferences.madhab }),
    ...(preferences.answerLanguage !== null && {
      answerLanguage: preferences.answerLanguage,
    }),
    ...(preferences.answerLength !== null && {
      answerLength: preferences.answerLength,
    }),
    ...(preferences.showArabic !== null && {
      showArabic: preferences.showArabic,
    }),
    ...(kept &&
      !memory.includes(kept) && {
        memory: next.length <= MEMORY_LIMIT ? next : [...memory],
      }),
  };
};
