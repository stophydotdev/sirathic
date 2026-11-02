import { embedQuery } from "@sirathic/core/search/embedding";
import { db } from "@sirathic/db";
import { askedBy, askedTopics, EMBEDDING } from "@sirathic/db/schema";
import { generateText, Output } from "ai";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { NOOR_SIDE_MODEL } from "../models/noor";
import { yesChances } from "./clef";

const ASKED_CHARS = 1_500;
const QUESTION_CHARS = 160;
const NEAR_DISTANCE = 0.45;
const SAME_CHANCE = 0.7;
const CANDIDATES = 5;
const SPECIFIC_CHANCE = 0.5;
const SPECIFIC_TEXT = /[\p{Nd}@]|https?:|www\./u;
const SPECIFICS = {
  person:
    "Does passage p1 name a private person, such as Ahmed or Fatima? Prophets, the Prophet's family, Companions and scholars of the past do not count.",
  place: "Does passage p1 name a town, city or country? Makkah and Madinah do not count.",
  company: "Does passage p1 name a company or an organisation?",
  date: "Does passage p1 name a calendar date or a clock time, such as 5 March or 3 pm?",
};

const PROMPT = `You turn a message someone sent to an Islamic answering engine into the general question an article could answer, or SKIP.

Write the question the way people search for it, as short as it can be while keeping its meaning, in English and in your own words, never copying the message's wording: "Is music haram?", "Does bleeding break wudu?", "Can a traveller combine Dhuhr and Asr?".

Keep only the ruling or topic. Drop every detail about the person and everyone they mention: names, places, ages, dates, amounts, jobs, family members, health, events and quotes. If those details change the ruling, keep only the general case ("Can a wife ask for khula if her husband harms her?").

SKIP when the message is not a general question about Islam, or only makes sense for this one person: a greeting, a task (write, translate, plan, search a site), a lookup for a time, place or date ("What time is Fajr in London today?" is SKIP), a question about their own text or file, a request for personal advice with no general ruling behind it, or anything that could identify them.`;

const general = z.object({
  kind: z
    .enum(["general ruling", "lookup", "task", "personal", "other"])
    .describe(
      "general ruling: a question about what Islam teaches that many people could ask. lookup: a time, date, place, direction or schedule. task: something to do for them. personal: only about their own situation. other: anything else.",
    ),
  question: z
    .string()
    .nullable()
    .describe("The general question when kind is general ruling, else null"),
});

export const sameQuestion = async (
  question: string,
  near: readonly { id: string; question: string }[],
) => {
  const chance = await yesChances(
    {
      search: question,
      passages: Object.fromEntries(near.map((topic, index) => [`p${index + 1}`, topic.question])),
    },
    Object.fromEntries(
      near.map((_, index) => [
        `p${index + 1}`,
        `Does passage p${index + 1} ask the same question as the search, so that one article would answer both?`,
      ]),
    ),
  );
  const scored = near.map((topic, index) => ({ id: topic.id, chance: chance(`p${index + 1}`) }));
  return scored.toSorted((a, b) => b.chance - a.chance).find(({ chance: c }) => c >= SAME_CHANCE)
    ?.id;
};

export const generalQuestion = async (asked: string) => {
  const { output } = await generateText({
    model: NOOR_SIDE_MODEL,
    system: PROMPT,
    prompt: asked.slice(0, ASKED_CHARS),
    output: Output.object({ schema: general }),
  });
  const question = output.question?.trim().slice(0, QUESTION_CHARS);
  if (output.kind !== "general ruling" || !question || SPECIFIC_TEXT.test(question))
    return undefined;
  const chance = await yesChances({ search: question, passages: { p1: question } }, SPECIFICS);
  return Object.keys(SPECIFICS).every((name) => (chance(name) ?? 1) < SPECIFIC_CHANCE)
    ? question
    : undefined;
};

export async function noteAsked(owner: string, asked: string) {
  const question = await generalQuestion(asked);
  if (!question) return;
  const embedding = await embedQuery(EMBEDDING, question);
  const distance = sql`${askedTopics.embedding} <=> ${JSON.stringify(embedding)}::halfvec`;
  const near = await db
    .select({ id: askedTopics.id, question: askedTopics.question })
    .from(askedTopics)
    .where(sql`${distance} < ${NEAR_DISTANCE}`)
    .orderBy(distance)
    .limit(CANDIDATES);
  const same =
    near.length > 0 ? await sameQuestion(question, near).catch(() => undefined) : undefined;
  const topicId =
    same ??
    (
      await db.insert(askedTopics).values({ question, embedding }).returning({ id: askedTopics.id })
    )[0]?.id;
  if (topicId === undefined) return;
  const added = await db
    .insert(askedBy)
    .values({ topicId, asker: owner })
    .onConflictDoNothing()
    .returning({ topicId: askedBy.topicId });
  if (added.length === 0) return;
  await db
    .update(askedTopics)
    .set({ people: sql`${askedTopics.people} + 1` })
    .where(eq(askedTopics.id, topicId));
}
