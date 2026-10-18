import { z } from "zod";

export const MADHABS = [
  "none",
  "hanafi",
  "maliki",
  "shafii",
  "hanbali",
] as const;
export const ANSWER_LANGUAGES = [
  "auto",
  "en",
  "ar",
  "fr",
  "ur",
  "id",
  "tr",
] as const;
export const ANSWER_LENGTHS = ["short", "default", "detailed"] as const;

export const settings = z.object({
  name: z.string().trim().max(80),
  madhab: z.enum(MADHABS),
  instructions: z.string().trim().max(1500),
  answerLanguage: z.enum(ANSWER_LANGUAGES),
  answerLength: z.enum(ANSWER_LENGTHS),
  showArabic: z.boolean(),
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
};
