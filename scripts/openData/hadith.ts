import type { z } from "zod";
import { blockOf, collectionSlugs } from "../../apps/data/src/resolve";
import type { hadithRecord } from "../../apps/data/src/schema";
import { loadFawaz } from "./fawaz";
import type { Output } from "./output";
import { sunnahSource } from "./sources";
import { loadSunnah, type SecondCopy } from "./sunnah";
import { groupBy } from "./util";
import { checkCopies, type HadithReason } from "./verify";

export type HadithRecord = z.infer<typeof hadithRecord>;

type Unverified = Pick<HadithRecord, "collection" | "number" | "inBook" | "similarity"> & {
  reason: HadithReason;
  secondNumber: string | null;
};

const inBookKey = (place: { book: number; hadith: number }) => `${place.book}:${place.hadith}`;

const numberOrder = (a: string, b: string) => {
  const [, aBase = "0", aLetter = ""] = /^(\d*)(.*)$/.exec(a) ?? [];
  const [, bBase = "0", bLetter = ""] = /^(\d*)(.*)$/.exec(b) ?? [];
  return Number(aBase) - Number(bBase) || aLetter.localeCompare(bLetter);
};

const agreedNumber = (partner: SecondCopy, number: string) =>
  partner.numbers.includes(number) ? number : (partner.numbers[0] ?? null);

const pairWithSecondCopies = (
  firstCopy: { number: string; inBook: { book: number; hadith: number } }[],
  secondCopies: SecondCopy[],
) => {
  const byPlace = new Map<string, SecondCopy[]>();
  for (const entry of secondCopies) {
    if (!entry.inBook || entry.arabic.trim() === "") continue;
    byPlace.set(inBookKey(entry.inBook), [...(byPlace.get(inBookKey(entry.inBook)) ?? []), entry]);
  }
  const paired = new Map<number, SecondCopy>();
  const placeAgreed = new Set<number>();
  const taken = new Set<SecondCopy>();
  const assign = (
    atPlace: boolean,
    accept: (candidates: SecondCopy[], index: number) => SecondCopy | undefined,
  ) => {
    for (const [index, copy] of firstCopy.entries()) {
      if (paired.has(index)) continue;
      const candidates = (
        atPlace ? (byPlace.get(inBookKey(copy.inBook)) ?? []) : secondCopies
      ).filter((c) => !taken.has(c) && c.arabic.trim() !== "");
      const chosen = accept(candidates, index);
      if (chosen) {
        paired.set(index, chosen);
        taken.add(chosen);
        if (atPlace) placeAgreed.add(index);
      }
    }
  };
  const sameNumber = (candidates: SecondCopy[], index: number) =>
    candidates.find((c) => c.numbers.includes(firstCopy[index]?.number ?? ""));
  assign(true, sameNumber);
  assign(true, (candidates) => (candidates.length === 1 ? candidates[0] : undefined));
  assign(false, sameNumber);
  return { paired, placeAgreed, unmatched: secondCopies.filter((entry) => !taken.has(entry)) };
};

const aliasesOf = (
  records: HadithRecord[],
  paired: Map<number, SecondCopy>,
  placeAgreed: Set<number>,
) => {
  const claims = new Map<string, Set<string>>();
  const claim = (alias: string, number: string) =>
    claims.set(alias, (claims.get(alias) ?? new Set<string>()).add(number));
  for (const [index, record] of records.entries()) {
    if (!record.verified) continue;
    if (record.inBook && placeAgreed.has(index)) claim(inBookKey(record.inBook), record.number);
    for (const number of paired.get(index)?.numbers ?? []) claim(number, record.number);
  }
  const own = new Set(records.map((record) => record.number));
  return Object.fromEntries(
    [...claims].flatMap(([alias, numbers]) => {
      const [only] = numbers;
      return numbers.size === 1 && only && only !== alias && !own.has(alias) ? [[alias, only]] : [];
    }),
  );
};

const countReasons = (records: HadithRecord[]) => {
  const counts = new Map<HadithReason, number>();
  for (const record of records) {
    if (record.reason) counts.set(record.reason, (counts.get(record.reason) ?? 0) + 1);
  }
  return Object.fromEntries(counts);
};

export const buildHadith = async (
  rawDir: string,
  sunnahDir: string,
  cachedOn: string,
  output: Output,
) => {
  const fawaz = await loadFawaz(rawDir, collectionSlugs);
  const secondCopies = loadSunnah(sunnahDir, collectionSlugs);
  const sources = [fawaz.source, sunnahSource(cachedOn)];
  const writes: Promise<number>[] = [];
  const summary = [];
  const recordsBySlug = new Map<string, HadithRecord[]>();
  const unverified: Unverified[] = [];
  const secondCopyOnly: { collection: string; numbers: string[]; inBook: SecondCopy["inBook"] }[] =
    [];
  for (const collection of fawaz.collections) {
    const { paired, placeAgreed, unmatched } = pairWithSecondCopies(
      collection.hadith,
      secondCopies.get(collection.slug) ?? [],
    );
    const records = collection.hadith.map((entry, index): HadithRecord => {
      const partner = paired.get(index);
      const check = checkCopies(
        entry,
        partner ? { arabic: partner.arabic, number: agreedNumber(partner, entry.number) } : null,
      );
      return {
        collection: collection.slug,
        number: entry.number,
        inBook: entry.inBook,
        arabic: entry.arabic,
        grades: entry.grades,
        verified: check.kind === "verified",
        reason: check.kind === "verified" ? null : check.reason,
        similarity: check.similarity,
      };
    });
    if (new Set(records.map((record) => record.number)).size !== records.length) {
      throw new Error(`duplicate numbers in ${collection.slug}`);
    }
    for (const [index, record] of records.entries()) {
      if (!record.reason) continue;
      unverified.push({
        collection: record.collection,
        number: record.number,
        inBook: record.inBook,
        reason: record.reason,
        similarity: record.similarity,
        secondNumber: paired.get(index)?.numbers.join(", ") || null,
      });
    }
    const sorted = records.toSorted((a, b) => numberOrder(a.number, b.number));
    for (const [block, hadith] of groupBy(sorted, (record) => blockOf(record.number))) {
      writes.push(
        output.json(`hadith/${collection.slug}/${block}.json`, { data: { hadith }, sources }),
      );
    }
    writes.push(
      output.json(
        `hadith/${collection.slug}/aliases.json`,
        aliasesOf(records, paired, placeAgreed),
      ),
    );
    for (const entry of unmatched) {
      secondCopyOnly.push({
        collection: collection.slug,
        numbers: entry.numbers,
        inBook: entry.inBook,
      });
    }
    recordsBySlug.set(collection.slug, sorted);
    summary.push({
      slug: collection.slug,
      name: collection.name,
      total: records.length,
      verified: records.filter((record) => record.verified).length,
      unverified: countReasons(records),
      secondCopyOnly: unmatched.length,
    });
  }
  await Promise.all(writes);
  await output.json("hadith/collections.json", { data: summary, sources });
  await output.json("hadith/unverified.json", {
    data: {
      reasons: {
        empty_arabic: "the first copy has no Arabic text for this number",
        no_second_copy: "no independent second copy of this hadith was found",
        arabic_mismatch:
          "the second copy at the same book and hadith number has different Arabic letters, spelling aside",
        number_mismatch: "the Arabic agrees but the two copies number the hadith differently",
        number_unchecked:
          "the Arabic agrees with a second copy at the same book and hadith place, but that copy has no hadith number to check",
      },
      hadith: unverified,
      secondCopyOnly,
    },
    sources,
  });
  return { recordsBySlug, summary, sources };
};
