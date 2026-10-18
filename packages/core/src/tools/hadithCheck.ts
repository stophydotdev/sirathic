import { db } from "@sirathic/db";
import { hadiths, texts } from "@sirathic/db/schema";
import { and, eq, inArray, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { ARABIC_STOPWORDS, arabicTokens } from "../search/arabic";
import { arabicForms, arabicKeywordIds } from "../search/arabicKeywordSearch";
import { hybridIds } from "../search/hybridSearch";
import { countWhere, tableSize } from "../search/wordCounts";
import { hadithsByIds } from "./hadithGet";

const CANDIDATES = 20;
const RARE_CANDIDATES = 10;
const RARE_WEIGHT = Math.log(1 / 0.08);
const SHOWN = 3;
const FOUND_AT = 0.8;
const SIMILAR_AT = 0.6;
const ARABIC_LETTER = /[ء-ي]/u;
const ARABIC_MARKS = /[ً-ٰٟـ]/gu;
const NOT_LETTERS = /[^\p{L}]/gu;

const quoteLexemes = z.array(z.object({ words: z.array(z.string()) }));
const candidateIds = z.array(z.object({ id: z.string() }));
const lexemeHits = z.array(
  z.object({ id: z.string(), word: z.string(), position: z.number() }),
);

type Hit = { word: string; position: number };

export const hadithCheckInput = z.object({
  text: z
    .string()
    .trim()
    .min(1)
    .describe("The saying to check, quoted in Arabic or English"),
});

const windowFor = (tokenCount: number) => tokenCount * 2 + 2;

const rarity = async (terms: { word: string; match: SQL }[]) => {
  const [total, found] = await Promise.all([
    tableSize(hadiths),
    Promise.all(
      terms.map(({ word, match }) => countWhere(hadiths, word, match)),
    ),
  ]);
  return new Map(
    terms.map(({ word }, index) => [
      word,
      Math.log((total + 1) / ((found[index] ?? 0) + 1)),
    ]),
  );
};

const arabicHits = async (
  text: string,
  candidates: Awaited<ReturnType<typeof hadithsByIds>>,
) => {
  const quoted = new Map(
    text
      .replaceAll(ARABIC_MARKS, "")
      .split(/\s+/u)
      .flatMap((word) => {
        const [token] = arabicTokens(word);
        return token && !ARABIC_STOPWORDS.has(token)
          ? [[token, word.replaceAll(NOT_LETTERS, "")] as const]
          : [];
      }),
  );
  return {
    weights: await rarity(
      [...quoted].map(([token, word]) => ({
        word: token,
        match: sql`search @@ to_tsquery('simple', ${arabicForms(word).join(" | ")})`,
      })),
    ),
    width: windowFor(arabicTokens(text).length),
    hitsOf: (id: string) =>
      arabicTokens(
        candidates.find((candidate) => candidate.id === id)?.textAr ?? "",
      ).flatMap((word, position) =>
        quoted.has(word) ? [{ word, position }] : [],
      ),
  };
};

const englishWeights = async (text: string) =>
  rarity(
    (
      quoteLexemes.parse([
        ...(await db.execute(
          sql`select tsvector_to_array(to_tsvector('english', ${text})) as words`,
        )),
      ])[0]?.words ?? []
    ).map((word) => ({
      word,
      match: sql`search @@ to_tsquery('simple', ${word})`,
    })),
  );

const englishRareIds = async (weights: Map<string, number>, limit: number) => {
  if (weights.size === 0) return [];
  const rare = [...weights.keys()].filter(
    (word) => (weights.get(word) ?? 0) > RARE_WEIGHT,
  );
  const score = sql.join(
    [...weights].map(
      ([word, weight]) =>
        sql`(case when search @@ to_tsquery('simple', ${word}) then ${weight}::float8 else 0 end)`,
    ),
    sql` + `,
  );
  return candidateIds
    .parse([
      ...(await db.execute(sql`
        select ${hadiths.id} as id from ${hadiths}
        where search @@ to_tsquery('simple', ${(rare.length > 0 ? rare : [...weights.keys()]).join(" | ")})
        order by ${score} desc
        limit ${limit}
      `)),
    ])
    .map((row) => row.id);
};

const englishHits = async (
  ids: string[],
  text: string,
  weights: Map<string, number>,
) => {
  const rows = await db.execute(sql`
      select ${hadiths.id} as id, entry.lexeme as word, position
      from ${hadiths}
      left join ${texts} on ${and(eq(texts.ref, hadiths.id), eq(texts.source, "hadeethenc-en"), eq(texts.kind, "translation"))}
      cross join lateral unnest(to_tsvector('english', concat_ws(' ', ${hadiths.textEn}, ${texts.body}))) as entry
      cross join lateral unnest(entry.positions) as position
      where ${inArray(hadiths.id, ids)}
        and entry.lexeme = any(tsvector_to_array(to_tsvector('english', ${text})))
    `);
  const hits = lexemeHits.parse([...rows]);
  return {
    weights,
    width: windowFor(text.split(/\s+/u).length),
    hitsOf: (id: string): Hit[] => hits.filter((hit) => hit.id === id),
  };
};

const nearbyShare = (
  weights: Map<string, number>,
  hits: Hit[],
  width: number,
) => {
  const weightOf = (words: Iterable<string>) =>
    [...words].reduce((sum, word) => sum + (weights.get(word) ?? 0), 0);
  const total = weightOf(weights.keys());
  if (total === 0) return 0;
  const sorted = hits.toSorted((a, b) => a.position - b.position);
  const most = sorted.reduce(
    (best, hit, end) =>
      Math.max(
        best,
        weightOf(
          new Set(
            sorted
              .slice(0, end + 1)
              .filter((other) => hit.position - other.position < width)
              .map((other) => other.word),
          ),
        ),
      ),
    0,
  );
  return Math.round((most / total) * 100) / 100;
};

export const hadithCheck = async (input: z.input<typeof hadithCheckInput>) => {
  const { text } = hadithCheckInput.parse(input);
  const arabic = ARABIC_LETTER.test(text);
  const weights = arabic ? undefined : await englishWeights(text);
  const ids = [
    ...new Set(
      (
        await Promise.all([
          hybridIds(hadiths, text, CANDIDATES),
          weights
            ? englishRareIds(weights, RARE_CANDIDATES)
            : arabicKeywordIds(hadiths, text, RARE_CANDIDATES),
        ])
      ).flat(),
    ),
  ];
  const candidates = await hadithsByIds(ids);
  const {
    weights: quoteWeights,
    width,
    hitsOf,
  } = weights
    ? await englishHits(ids, text, weights)
    : await arabicHits(text, candidates);
  const matches = candidates
    .map((candidate) =>
      Object.assign(candidate, {
        wordMatch: nearbyShare(quoteWeights, hitsOf(candidate.id), width),
      }),
    )
    .toSorted((a, b) => b.wordMatch - a.wordMatch)
    .slice(0, SHOWN);
  const best = matches[0]?.wordMatch ?? 0;
  return {
    verdict:
      best >= FOUND_AT ? "found" : best >= SIMILAR_AT ? "similar" : "not_found",
    matches,
  };
};
