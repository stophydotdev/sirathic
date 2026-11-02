import { SQL } from "bun";
import { generateText, Output } from "ai";
import { z } from "zod";
import { generalQuestion, sameQuestion } from "../apps/server/src/chat/asked";
import { NOOR_SIDE_MODEL } from "../apps/server/src/models/noor";
import { queue } from "../apps/web/src/content/discover/queue";
import { searchedQueries } from "./searchConsole";

export const ENOUGH_PEOPLE = 5;
const ASKED_TOPICS = 20;
const MIN_IMPRESSIONS = 10;
const SLUG_CHARS = 60;
const TOPICS = [
  "Daily life",
  "Food",
  "Family",
  "Money",
  "Zakat",
  "Purification",
  "Prayer",
  "Fasting",
  "Belief",
  "Quran",
  "Hajj",
] as const;

export type DiscoverTopic = { title: string; slug: string; topic: string; from: string };

type Candidate = { title: string; from: string; slug?: string; topic?: string };

const settings = z
  .object({
    DISCOVER_ASKED_DATABASE_URL: z.string().optional(),
    GSC_SERVICE_ACCOUNT: z.string().optional(),
  })
  .parse(process.env);

const askedRow = z.object({ question: z.string(), people: z.number() });

export const slugOf = (title: string) => {
  const slug = title
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");
  return slug.length <= SLUG_CHARS ? slug : slug.slice(0, SLUG_CHARS).replace(/-[^-]*$/u, "");
};

const askedQuestions = async (): Promise<Candidate[]> => {
  if (!settings.DISCOVER_ASKED_DATABASE_URL) return [];
  const sql = new SQL(settings.DISCOVER_ASKED_DATABASE_URL);
  const rows =
    await sql`select question, people from asked_topics where people >= ${ENOUGH_PEOPLE} order by people desc, created_at limit ${ASKED_TOPICS}`;
  await sql.close();
  return z
    .array(askedRow)
    .parse(rows)
    .map((row) => ({ title: row.question, from: `asked by ${row.people} people` }));
};

const searchedQuestions = async (): Promise<Candidate[]> => {
  const queries = await searchedQueries(settings.GSC_SERVICE_ACCOUNT, MIN_IMPRESSIONS).catch(
    (err: Error) => {
      console.log(`Search Console skipped: ${err.message}`);
      return [];
    },
  );
  const titles = await Promise.all(
    queries.map((query) => generalQuestion(query, NOOR_SIDE_MODEL).catch(() => undefined)),
  );
  return queries.flatMap((query, index) => {
    const title = titles[index];
    return title ? [{ title, from: `searched as "${query}"` }] : [];
  });
};

const topicOf = async (title: string) =>
  (
    await generateText({
      model: NOOR_SIDE_MODEL,
      prompt: `Which section of an Islamic Q&A site does this question belong in? ${title}`,
      output: Output.object({ schema: z.object({ topic: z.enum(TOPICS) }) }),
    })
  ).output.topic;

export async function nextTopics(
  count: number,
  writtenTitles: readonly string[],
  isWritten: (slug: string) => boolean,
) {
  const candidates: Candidate[] = [
    ...(await askedQuestions()),
    ...(await searchedQuestions()),
    ...queue.map(({ title, slug, topic }) => ({ title, slug, topic, from: "queue" })),
  ];
  const known = writtenTitles.map((title, index) => ({ id: `written-${index}`, question: title }));
  return candidates.reduce<Promise<DiscoverTopic[]>>(async (before, candidate) => {
    const chosen = await before;
    const slug = candidate.slug ?? slugOf(candidate.title);
    if (chosen.length >= count || !slug || isWritten(slug)) return chosen;
    if (chosen.some((entry) => entry.slug === slug)) return chosen;
    const others = [
      ...known,
      ...chosen.map((entry) => ({ id: entry.slug, question: entry.title })),
    ];
    const same = await sameQuestion(candidate.title, others).catch(() => undefined);
    if (same !== undefined) return chosen;
    const topic = candidate.topic ?? (await topicOf(candidate.title));
    return [...chosen, { title: candidate.title, slug, topic, from: candidate.from }];
  }, Promise.resolve([]));
}
