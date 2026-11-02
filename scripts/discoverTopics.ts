import { SQL, sql } from "bun";
import { z } from "zod";
import { generalQuestion, sameQuestion } from "../apps/server/src/chat/asked";
import { CLEF, pickOptions } from "../apps/server/src/chat/clef";
import { queue } from "../apps/web/src/content/discover/queue";

export const ENOUGH_PEOPLE = 5;
const ENOUGH_SITES = 5;
const FATWA_SAMPLE = 100;
const NEIGHBOURS = 40;
const SAME_TOPIC_DISTANCE = 0.3;
const SEARCH_MATCHES = 20;
const SEARCH_PROPERTY = "sc-domain:sirathic.com";
const DAY_MS = 86_400_000;
const SLUG_CHARS = 60;
const SECTIONS = {
  "Daily life":
    "manners, clothing, music, animals, work, health, entertainment and everyday conduct",
  Food: "what may be eaten or drunk, and how animals are slaughtered",
  Family: "marriage, weddings, divorce, children, parents and relatives",
  Money: "trade, loans, interest, insurance, investing and inheritance",
  Zakat: "zakat and charity",
  Purification: "wudu, ghusl, impurity, menstruation and cleanliness",
  Prayer: "salah, dua, the mosque and Friday prayer",
  Fasting: "Ramadan and fasting",
  Belief: "belief in Allah, the prophets, the unseen, the afterlife and other religions",
  Quran: "reciting, memorizing and understanding the Quran",
  Hajj: "Hajj and Umrah",
};

export type DiscoverTopic = { title: string; slug: string; topic: string; from: string };

type Candidate = {
  title: string;
  votes: number;
  impressions: number;
  from: string;
  reword: boolean;
  slug?: string;
  topic?: string;
};

const settings = z
  .object({
    DISCOVER_ASKED_DATABASE_URL: z.string().optional(),
    GSC_ACCESS_TOKEN: z.string().optional(),
  })
  .parse(process.env);

const fatwaRow = z.object({ title: z.string(), sites: z.number() });
const askedRow = z.object({ question: z.string(), people: z.number() });
const searchReport = z.object({
  rows: z.array(z.object({ keys: z.array(z.string()), impressions: z.number() })).default([]),
});

const strongestFirst = (a: Candidate, b: Candidate) =>
  b.votes - a.votes || b.impressions - a.impressions;

const wordsOf = (text: string) =>
  text
    .toLowerCase()
    .match(/\p{L}+/gu)
    ?.join(" ");

const skipped = (source: string) => (err: Error) => {
  console.log(`${source} skipped: ${err.message}`);
  return [];
};

const day = (ago: number) => new Date(Date.now() - ago * DAY_MS).toISOString().slice(0, 10);

export const slugOf = (title: string) => {
  const slug = title
    .normalize("NFKD")
    .replaceAll(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");
  return slug.length <= SLUG_CHARS ? slug : slug.slice(0, SLUG_CHARS + 1).replace(/-[^-]*$/u, "");
};

const fatwaQuestions = async (): Promise<Candidate[]> => {
  const rows = await sql`
    with picked as (
      select title, embedding_m3 from fatwas tablesample system (0.2)
      where question is not null and id !~ '#' and embedding_m3 is not null
      limit ${FATWA_SAMPLE}
    )
    select title, (
      select count(distinct near.source)::int from (
        select source, embedding_m3 <=> picked.embedding_m3 as distance from fatwas
        order by embedding_m3 <=> picked.embedding_m3 limit ${NEIGHBOURS}
      ) near where near.distance < ${SAME_TOPIC_DISTANCE}
    ) as sites from picked`;
  return z
    .array(fatwaRow)
    .parse(rows)
    .filter((row) => row.sites >= ENOUGH_SITES)
    .map((row) => ({
      title: row.title,
      votes: row.sites,
      impressions: 0,
      from: `asked on ${row.sites} fatwa sites`,
      reword: true,
    }));
};

const askedQuestions = async (): Promise<Candidate[]> => {
  if (!settings.DISCOVER_ASKED_DATABASE_URL) return [];
  const asked = new SQL(settings.DISCOVER_ASKED_DATABASE_URL);
  const rows =
    await asked`select question, people from asked_topics where people >= ${ENOUGH_PEOPLE}`;
  await asked.close();
  return z
    .array(askedRow)
    .parse(rows)
    .map((row) => ({
      title: row.question,
      votes: row.people,
      impressions: 0,
      from: `asked by ${row.people} people`,
      reword: false,
    }));
};

const searchedQueries = async () => {
  if (!settings.GSC_ACCESS_TOKEN) {
    console.log("Search Console off: no GSC_ACCESS_TOKEN");
    return [];
  }
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SEARCH_PROPERTY)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${settings.GSC_ACCESS_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        startDate: day(31),
        endDate: day(3),
        dimensions: ["query"],
        rowLimit: 100,
      }),
    },
  );
  if (!response.ok) throw new Error(`Search Console answered ${response.status}`);
  return searchReport
    .parse(await response.json())
    .rows.flatMap((row) =>
      row.keys[0] ? [{ query: row.keys[0], impressions: row.impressions }] : [],
    );
};

const addSearchVotes = async (ranked: readonly Candidate[]) => {
  const queries = await searchedQueries().catch(skipped("Search Console"));
  const top = ranked.slice(0, SEARCH_MATCHES);
  const near = top.map((candidate, index) => ({ id: String(index), question: candidate.title }));
  await queries.reduce<Promise<void>>(async (before, { query, impressions }) => {
    await before;
    const match = await sameQuestion(query, near).catch(() => undefined);
    const candidate = top.find((_, index) => String(index) === match);
    if (!candidate) return;
    candidate.impressions += impressions;
    candidate.from += `, ${impressions} search impressions`;
  }, Promise.resolve());
};

const sectionOf = async (title: string) =>
  (
    await pickOptions(
      CLEF,
      { question: title },
      {
        section: {
          instructions: "Which section of an Islamic Q&A site does this question belong in?",
          criteria: SECTIONS,
        },
      },
    )
  ).answers.section?.choice;

export async function nextTopics(
  count: number,
  writtenTitles: readonly string[],
  isWritten: (slug: string) => boolean,
) {
  const found = [
    ...(await askedQuestions().catch(skipped("Asked questions"))),
    ...(await fatwaQuestions().catch(skipped("Fatwa questions"))),
  ].toSorted(strongestFirst);
  await addSearchVotes(found);
  const candidates: Candidate[] = [
    ...found.toSorted(strongestFirst),
    ...queue.map(({ title, slug, topic }) => ({
      title,
      slug,
      topic,
      votes: 0,
      impressions: 0,
      from: "queue",
      reword: false,
    })),
  ];
  const known = writtenTitles.map((title, index) => ({ id: `written-${index}`, question: title }));
  return candidates.reduce<Promise<DiscoverTopic[]>>(async (before, candidate) => {
    const chosen = await before;
    if (chosen.length >= count) return chosen;
    const title = candidate.reword
      ? await generalQuestion(candidate.title).catch(() => undefined)
      : candidate.title;
    if (!title || (candidate.reword && wordsOf(title) === wordsOf(candidate.title))) return chosen;
    const slug = candidate.slug ?? slugOf(title);
    if (!slug || isWritten(slug) || chosen.some((entry) => entry.slug === slug)) return chosen;
    const others = [
      ...known,
      ...chosen.map((entry) => ({ id: entry.slug, question: entry.title })),
    ];
    const same = await sameQuestion(title, others).catch(() => "unchecked");
    if (same !== undefined) return chosen;
    const topic = candidate.topic ?? (await sectionOf(title).catch(() => undefined));
    if (!topic) return chosen;
    return [...chosen, { title, slug, topic, from: candidate.from }];
  }, Promise.resolve([]));
}
