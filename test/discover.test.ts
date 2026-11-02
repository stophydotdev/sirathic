import { PGlite } from "@electric-sql/pglite";
import { expect, test } from "bun:test";
import { parseHadithRef, type HadithRef } from "../apps/data/src/resolve";
import { article } from "../apps/web/src/content/discover/schema";
import { ASKED_ENOUGH, ENOUGH_PEOPLE, fromUsers, slugOf } from "../scripts/discoverTopics";
import { checkCopies, type Check, type Copy } from "../scripts/openData/verify";

const cited = "https://sunnah.com/bukhari:513";
const unused = "https://quran.com/5/6";

const verse = { arabic: "ٱلنِّسَآءَ", translation: "women", reference: "5:6", url: unused };

const draft = {
  title: "Does touching a woman break wudu?",
  headline: "The schools give three answers",
  cover: "اللمس",
  slug: "touching-a-woman-and-wudu",
  topic: "Purification",
  tint: "teal",
  summary: { text: "The schools differ.", citations: [cited] },
  updated: "2026-10-31",
  reviewed: false,
  sources: [{ url: cited, title: "Sahih al-Bukhari 513" }],
  sections: [{ heading: "Hadith", paragraphs: [{ text: "Aisha's feet.", citations: [cited] }] }],
  related: [],
};

test.each([
  [
    "a citation that is not in sources",
    { ...draft, verse, sources: [{ url: unused, title: "Al-Ma'idah 5:6" }] },
    `${cited} is not in sources`,
  ],
  [
    "a source nobody cites",
    { ...draft, sources: [...draft.sources, { url: unused, title: "Al-Ma'idah 5:6" }] },
    `${unused} is never cited`,
  ],
])("an article with %s is rejected", (_name, input, message) => {
  expect(article.safeParse(input).error?.issues.map((issue) => issue.message)).toEqual([message]);
});

test("a source cited only by the verse block counts as cited", () => {
  const input = { ...draft, verse, sources: [...draft.sources, { url: unused, title: "5:6" }] };
  expect(article.safeParse(input).success).toBe(true);
});

const references: [string, HadithRef | null][] = [
  ["muslim 2291a", { kind: "number", collection: "muslim", number: "2291a" }],
  ["Sahih Muslim 2291 a", { kind: "number", collection: "muslim", number: "2291a" }],
  ["Sunan Abi Dawud 1701", { kind: "number", collection: "abudawud", number: "1701" }],
  ["Sunan an-Nasa'i 125b", { kind: "number", collection: "nasai", number: "125b" }],
  ["bukhari, book 1, hadith 1", { kind: "inBook", collection: "bukhari", book: 1, hadith: 1 }],
  ["Quran 2:255", null],
];

test.each(references)("the reference %s resolves to %j", (ref, expected) => {
  expect(parseHadithRef(ref)).toEqual(expected);
});

const intention = { number: "1", arabic: "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى" };

const comparisons: [string, Copy | null, Check][] = [
  [
    "the same Arabic without diacritics and the same number",
    { number: "1", arabic: "انما الاعمال بالنيات وانما لكل امرء ما نوى" },
    { kind: "verified", similarity: 1 },
  ],
  [
    "a second copy that drops half the text",
    { number: "1", arabic: "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ" },
    { kind: "unverified", reason: "arabic_mismatch", similarity: 0.6667 },
  ],
  [
    "the same Arabic under another number",
    { number: "2", arabic: intention.arabic },
    { kind: "unverified", reason: "number_mismatch", similarity: 1 },
  ],
  ["no second copy", null, { kind: "unverified", reason: "no_second_copy", similarity: null }],
];

test.each(comparisons)("a hadith with %s", (_name, second, expected) => {
  expect(checkCopies(intention, second)).toEqual(expected);
});

test("a hadith with no Arabic is never verified, even with a second copy", () => {
  expect(checkCopies({ number: "1", arabic: "" }, intention)).toEqual({
    kind: "unverified",
    reason: "empty_arabic",
    similarity: null,
  });
});

test("an asked question becomes a short slug that keeps every whole word", () => {
  expect(slugOf("Does vomiting break the fast?")).toBe("does-vomiting-break-the-fast");
  expect(slugOf("Is ṣalāh valid in a moving car?")).toBe("is-salah-valid-in-a-moving-car");
  expect(
    slugOf("Can a wife ask for khula if her husband refuses to pay the maintenance he owes her?"),
  ).toBe("can-a-wife-ask-for-khula-if-her-husband-refuses-to-pay-the");
  expect(slugOf("Could a woman pray at home instead of the mosque on Eid days?")).toBe(
    "could-a-woman-pray-at-home-instead-of-the-mosque-on-eid-days",
  );
});

const names = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}`);

test("a topic needs five people who still exist, whatever its stored counter says", async () => {
  const pg = new PGlite();
  await pg.exec(`
    create table users (id text primary key);
    create table asked_topics (id uuid primary key default gen_random_uuid(), question text not null, people integer not null default 0);
    create table asked_by (
      topic_id uuid not null references asked_topics(id) on delete cascade,
      asker text not null references users(id) on delete cascade,
      primary key (topic_id, asker)
    );
  `);
  const ask = async (question: string, askers: string[]) => {
    const { rows } = await pg.query<{ id: string }>(
      "insert into asked_topics (question, people) values ($1, $2) returning id",
      [question, ENOUGH_PEOPLE],
    );
    await pg.query("insert into users select unnest($1::text[]) on conflict do nothing", [askers]);
    await pg.query("insert into asked_by select $1, unnest($2::text[])", [rows[0]?.id, askers]);
  };
  await ask("Is it allowed to pray behind an imam of another school?", names(5, "a"));
  await ask("Is a slanted question allowed?", names(5, "b"));
  await pg.query("delete from users where id in ('b1', 'b2', 'b3', 'b4')");
  const { rows } = await pg.query(ASKED_ENOUGH, [ENOUGH_PEOPLE]);
  expect(rows).toEqual([
    { question: "Is it allowed to pray behind an imam of another school?", people: 5 },
  ]);
});

test("an article waits for review when its topic came from users' questions", () => {
  const topic = { title: "Is X allowed?", slug: "is-x-allowed", topic: "Prayer" };
  expect([
    fromUsers([{ ...topic, from: "asked by 5 people, 120 search impressions" }]),
    fromUsers([{ ...topic, from: "asked on 6 fatwa sites" }]),
    fromUsers([{ ...topic, from: "queue" }]),
  ]).toEqual([true, false, false]);
});
