import { z } from "zod";
import type { ChatMessage } from "../shared/messages";

const QUOTED = /"([^"\n]+)"|“([^”\n]+)”|«([^»\n]+)»|﴿([^﴾\n]+)﴾/gu;
const QUOTE_LINE = /^>\s*([^"“«﴿\n]+)$/gmu;
const ARABIC_LETTER = /[ء-ي]/gu;
const LETTER = /\p{L}/gu;
const INSERTION = /\[[^[\]\n]{0,80}\]|\([^()\n]{0,80}\)|\.\.\.|…/gu;
const CLAUSE_END = /[.,;:!?،؛]/u;
const HONORIFIC =
  /\b(?:peace and blessings (?:of allah )?be upon him|peace be upon him|sallallahu [a-z ]*sallam|may allah be pleased with (?:him|her|them)|radiyallahu [a-z]+)\b|صل[ىي] الله عليه وسلم|رضي الله عن(?:ه|ها|هم|هما)/gu;
const REFERENCED =
  /^[\s.,;:]*(\([^()\n]*\p{Nd}[^()\n]*\)[\s.,]*)?\[\p{Nd}+\](?:\(https?:\/\/(?:www\.)?(quran\.com|sunnah\.com)\/)?/u;
const ENGLISH = new Set(
  "the and of to is in that he it for you with be his was not on are by who they them we said will have from as i my your their this whoever".split(
    " ",
  ),
);
const MIN_WORDS = 4;
const MAX_LISTED = 5;
const SHOWN_CHARS = 200;

export const withText = z.object({ text: z.string() });

export const earlierToolTexts = (messages: readonly ChatMessage[]) =>
  messages.flatMap((message) =>
    message.parts.flatMap((part) =>
      "state" in part && part.state === "output-available"
        ? [withText.safeParse(part.output).data?.text ?? JSON.stringify(part.output)]
        : [],
    ),
  );

const normal = (text: string) =>
  ` ${text
    .replace(/[ﷺﷻ]|\\[nrt]/gu, " ")
    .normalize("NFKD")
    .replace(/\p{M}|[ـۥۦ]/gu, "")
    .toLowerCase()
    .replace(/[’‘`'ʿʾ]/gu, "")
    .replace(HONORIFIC, " ")
    .replace(/[اٱء]/gu, "")
    .replace(/ى/gu, "ي")
    .replace(/ة/gu, "ه")
    .replace(/our\b/gu, "or")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/(?<=^| )ي (?=[ء-ي])/gu, "ي")
    .trim()} `;

const wordsOf = (text: string) => text.trim().split(" ").filter(Boolean);

const share = (text: string, letters: RegExp) =>
  (text.match(letters)?.length ?? 0) / Math.max(1, text.match(LETTER)?.length ?? 0);

const checkable = (quote: string) => {
  if (share(quote, ARABIC_LETTER) > 0.9) return true;
  const words = wordsOf(normal(quote));
  return words.filter((word) => ENGLISH.has(word)).length * 5 >= words.length;
};

const verseOrHadith = (after: string) => {
  const found = REFERENCED.exec(after);
  return found !== null && (found[1] !== undefined || found[2] !== undefined);
};

const quotesIn = (answer: string) => [
  ...[...answer.matchAll(QUOTED)].flatMap((match) =>
    verseOrHadith(answer.slice(match.index + match[0].length))
      ? [match.slice(1).find(Boolean) ?? ""]
      : [],
  ),
  ...[...answer.matchAll(QUOTE_LINE)].flatMap((match) =>
    match[1] && share(match[1], ARABIC_LETTER) > 0.5 ? [match[1]] : [],
  ),
];

const matches = (quote: string, corpus: string) => {
  const found = (words: string[]) => corpus.includes(` ${words.join(" ")} `);
  return quote.split(INSERTION).every((piece) => {
    const clauses = piece
      .split(CLAUSE_END)
      .map((clause) => wordsOf(normal(clause)))
      .filter((words) => words.length > 0);
    return clauses.every((clause, index) => {
      const before = clauses[index - 1];
      const after = clauses[index + 1];
      if (clause.length >= MIN_WORDS || !before || !after) return found(clause);
      return found([...before, ...clause]) || found([...clause, ...after]);
    });
  });
};

export function unmatchedQuotes(answer: string, sources: readonly string[]) {
  const joined = sources.join("\n");
  const corpus = `${normal(joined.replace(INSERTION, " "))}${normal(joined)}`;
  const unmatched = quotesIn(answer).filter((quote) => checkable(quote) && !matches(quote, corpus));
  return [...new Set(unmatched.map((quote) => quote.trim().slice(0, SHOWN_CHARS)))].slice(
    0,
    MAX_LISTED,
  );
}
