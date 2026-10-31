import type { z } from "zod";
import type { hadithReason } from "../../apps/data/src/schema";
import { hadithKey } from "../hadithKey";

export type HadithReason = z.infer<typeof hadithReason>;

export type Copy = { number: string; arabic: string };

type SecondCopy = { number: string | null; arabic: string };

export type Check =
  | { kind: "verified"; similarity: number }
  | { kind: "unverified"; reason: HadithReason; similarity: number | null };

const arabicLetters = (text: string) =>
  text
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/[\u0624\u0626]/g, "\u0621")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .normalize("NFKD")
    .replace(/[^\u0621-\u064A]/g, "");

const bigrams = (text: string) => {
  const counts = new Map<string, number>();
  for (let index = 0; index < text.length - 1; index++) {
    const pair = text.slice(index, index + 2);
    counts.set(pair, (counts.get(pair) ?? 0) + 1);
  }
  return counts;
};

const similarity = (first: string, second: string) => {
  const a = arabicLetters(first);
  const b = arabicLetters(second);
  if (a === b) return a === "" ? 0 : 1;
  const counts = bigrams(b);
  let shared = 0;
  for (const [pair, count] of bigrams(a)) shared += Math.min(count, counts.get(pair) ?? 0);
  return (2 * shared) / (a.length - 1 + (b.length - 1));
};

const spellingKey = (text: string) => hadithKey(text).replace(/[ؤئ]/gu, "ء");

export const checkCopies = (copy: Copy, second: SecondCopy | null): Check => {
  if (copy.arabic.trim() === "")
    return { kind: "unverified", reason: "empty_arabic", similarity: null };
  if (!second || second.arabic.trim() === "") {
    return { kind: "unverified", reason: "no_second_copy", similarity: null };
  }
  const score = Math.round(similarity(copy.arabic, second.arabic) * 10_000) / 10_000;
  if (spellingKey(copy.arabic) !== spellingKey(second.arabic)) {
    return { kind: "unverified", reason: "arabic_mismatch", similarity: score };
  }
  if (second.number === null) {
    return { kind: "unverified", reason: "number_unchecked", similarity: score };
  }
  if (second.number !== copy.number) {
    return { kind: "unverified", reason: "number_mismatch", similarity: score };
  }
  return { kind: "verified", similarity: score };
};

export const letterNumber = (base: number, part: number) =>
  `${base}${String.fromCharCode(96 + part)}`;
