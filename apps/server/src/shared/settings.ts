import { z } from "zod";

export const MADHABS = ["none", "hanafi", "maliki", "shafii", "hanbali"] as const;
export const ANSWER_LANGUAGES = ["auto", "en", "ar", "fr", "ur", "id", "tr"] as const;
export const ANSWER_LENGTHS = ["short", "default", "detailed"] as const;
export const LIST_STYLES = ["lists", "default", "paragraphs"] as const;
export const MEMORY_LIMIT = 20;
export const MEMORY_CHARS = 200;

const isTimeZone = (zone: string) => {
  try {
    return Intl.DateTimeFormat("en", { timeZone: zone }).resolvedOptions().timeZone.length > 0;
  } catch {
    return false;
  }
};

export const timezone = z.string().refine(isTimeZone, "unknown time zone");

export const settings = z.object({
  name: z.string().trim().max(80),
  about: z.string().trim().max(500),
  timezone: timezone.or(z.literal("")),
  madhab: z.enum(MADHABS),
  instructions: z.string().trim().max(1500),
  answerLanguage: z.enum(ANSWER_LANGUAGES),
  answerLength: z.enum(ANSWER_LENGTHS),
  listStyle: z.enum(LIST_STYLES),
  showArabic: z.boolean(),
  memory: z.array(z.string().trim().min(1).max(MEMORY_CHARS)).max(MEMORY_LIMIT),
  saveMemory: z.boolean(),
  usePastChats: z.boolean(),
});

export const settingsUpdate = settings.partial();

export type Settings = z.infer<typeof settings>;

export const DEFAULT_SETTINGS: Settings = {
  name: "",
  about: "",
  timezone: "",
  madhab: "none",
  instructions: "",
  answerLanguage: "auto",
  answerLength: "default",
  listStyle: "default",
  showArabic: true,
  memory: [],
  saveMemory: true,
  usePastChats: true,
};
