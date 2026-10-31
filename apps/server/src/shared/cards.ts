import { z } from "zod";
import { settingsUpdate } from "./settings";

export const ANSWER_CARDS = [
  "show_steps",
  "show_quiz",
  "show_translation",
  "show_places",
  "prayer_times",
  "islamic_dates",
  "change_setting",
  "todo_write",
] as const;

export const PRAYERS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as const;

export const ISLAMIC_EVENTS = [
  "Ramadan begins",
  "Eid al-Fitr",
  "Day of Arafah",
  "Eid al-Adha",
  "Ashura",
] as const;

const summary = z
  .string()
  .max(200)
  .describe(
    "One short sentence (under 15 words) naming what this card shows, for surfaces that can't render it. Don't repeat its contents. Write this last.",
  );

export const steps = z.object({
  steps: z
    .array(
      z.object({
        title: z.string().max(80).describe("Name of this step (a few words, imperative)."),
        description: z
          .string()
          .max(600)
          .describe(
            "A short paragraph explaining how to do this step and why it matters, enough detail to follow without guessing.",
          ),
      }),
    )
    .min(2)
    .max(8),
  view: z
    .enum(["stepper", "list"])
    .optional()
    .describe(
      "How the steps are first shown. 'stepper' (the default) reveals one step at a time: use it when steps must be done in order. 'list' shows everything at once: use it for short checklists the user will scan, not follow.",
    ),
  summary,
});

export const quiz = z.object({
  title: z
    .string()
    .max(80)
    .describe("Title of the quiz, like 'Pillars of Wudu' or 'Surah Al-Mulk'."),
  mode: z
    .enum(["quiz", "flashcards"])
    .optional()
    .describe(
      "Which view the card opens in. 'quiz' (default): graded multiple choice, one question at a time, with a score at the end. 'flashcards': the same questions as flip cards for review and memorization rather than testing. Use it when the user asks for flashcards or to study or review. The user can switch views either way.",
    ),
  questions: z
    .array(
      z
        .object({
          prompt: z.string().max(400).describe("The question text shown to the user."),
          options: z
            .array(z.string().max(200))
            .min(2)
            .max(5)
            .describe(
              "The answer choices, with plausible wrong answers that seem reasonable. The card shuffles them.",
            ),
          answer: z.string().max(200).describe("The correct choice, copied exactly from options."),
          explanation: z
            .string()
            .max(600)
            .describe(
              "Why the correct answer is correct, shown after the user answers. Keep it concise.",
            ),
          hint: z
            .string()
            .max(200)
            .optional()
            .describe(
              "Optional hint the user can reveal before answering. Nudge toward the answer without giving it away.",
            ),
        })
        .refine(({ options, answer }) => options.includes(answer), {
          message: "answer must be copied exactly from options",
        }),
    )
    .min(1)
    .max(10)
    .describe("The quiz questions, in the order they should be presented."),
  summary,
});

export const translation = z.object({
  text: z
    .string()
    .max(2000)
    .describe(
      "The exact text being translated, as the user gave it (lightly cleaned up; no quotes around it).",
    ),
  sourceLanguage: z
    .string()
    .max(40)
    .describe("Display name of the source language, in the conversation's language, like English."),
  translation: z
    .string()
    .max(2000)
    .describe(
      "The translation, in the register that best fits the situation the user described. Arabic carries full harakat. Plain text only: no romanization, notes or alternatives here.",
    ),
  targetLanguage: z
    .string()
    .max(40)
    .describe(
      "Display name of the target language, in the conversation's language. Include the region or variety when it matters, like Arabic (Egyptian).",
    ),
  targetLang: z
    .string()
    .max(20)
    .describe('BCP-47 tag of the translation, like "ar", "ur" or "es-MX".'),
  pronunciation: z
    .string()
    .max(2000)
    .optional()
    .describe(
      "Romanization of the whole translation whenever the target script is not Latin, however long the passage is: always fill it for Arabic, Urdu, Persian, Chinese, Japanese, Russian and other non-Latin scripts. Omit it only for Latin-script targets.",
    ),
  summary,
});

export const placeChoice = z.object({
  placeId: z
    .string()
    .max(200)
    .describe(
      "The placeId of a google.maps.search result from this chat. Copy it exactly: it is case-sensitive.",
    ),
  description: z
    .string()
    .max(400)
    .optional()
    .describe("Optional. One or two short sentences on what to expect there."),
  tips: z
    .array(z.string().max(40))
    .max(3)
    .optional()
    .describe(
      "Optional. Up to three very short (2 to 4 word) practical labels, like 'Women's area' or 'Jumu'ah 1:30'. Not full sentences.",
    ),
});

export const places = z.object({
  places: z.array(placeChoice).min(1).max(8),
  summary,
});

export const place = z.object({
  placeId: z.string(),
  placeUrl: z.url(),
  name: z.string(),
  address: z.string().optional(),
  rating: z.number().optional(),
  reviews: z.number().optional(),
  openStatus: z.string().optional(),
  thumbnailUrl: z.url().optional(),
  website: z.string().optional(),
});

export const shownPlaces = z.object({
  places: z.array(place.and(placeChoice)),
});

type Question = z.infer<typeof quiz>["questions"][number];

const hashOf = (text: string) =>
  [...text].reduce((hash, char) => Math.imul(hash, 31) + (char.codePointAt(0) ?? 0), 7);

export const shuffledOptions = ({ prompt, options }: Question) => {
  const shuffled = [...options];
  shuffled.sort((a, b) => hashOf(prompt + a) - hashOf(prompt + b));
  return shuffled;
};

export const prayerTimetable = z.object({
  place: z.string().optional(),
  timezone: z.string(),
  days: z.array(z.object({ date: z.iso.date() }).and(z.record(z.enum(PRAYERS), z.string()))),
});

export const islamicDays = z.object({
  gregorian: z.iso.date(),
  hijri: z.string(),
  upcoming: z.array(
    z.object({ name: z.enum(ISLAMIC_EVENTS), gregorian: z.iso.date(), hijri: z.string() }),
  ),
});

export const settingChange = settingsUpdate
  .pick({ madhab: true, name: true, about: true })
  .refine((change) => Object.keys(change).length > 0, "change at least one setting");

export const TODO_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;

export const todo = z.object({
  id: z.string().describe("Unique identifier for the TODO item"),
  content: z.string().describe("The description/content of the todo item"),
  status: z.enum(TODO_STATUSES).describe("The current status of the TODO item"),
});

export const todoWrite = z.object({
  todos: z.array(todo).min(2).describe("Array of TODO items to update or create"),
  merge: z
    .boolean()
    .describe(
      "Whether to merge the todos with the existing todos. If true, the todos will be merged into the existing todos based on the id field. If false, the new todos will replace the existing todos.",
    ),
});

export const todoList = z.object({ todos: z.array(todo) });

export const mergeTodos = (
  current: z.infer<typeof todo>[],
  { todos, merge }: z.infer<typeof todoWrite>,
) => [...new Map([...(merge ? current : []), ...todos].map((item) => [item.id, item])).values()];
