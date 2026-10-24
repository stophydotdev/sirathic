import { z } from "zod";
import { listSessions } from "./sessions";

const MIN_CHARS = 2;
const PAST_LIMIT = 3;
const SUGGESTION_LIMIT = 6;
const TIMEOUT_MS = 1_500;

const duckDuckGo = z.tuple([z.string(), z.array(z.string())]);

const webSuggestions = (query: string) =>
  fetch(`https://duckduckgo.com/ac/?${new URLSearchParams({ q: query, type: "list" })}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
    .then((res) => res.json())
    .then((body) => duckDuckGo.parse(body)[1])
    .catch(() => []);

export async function suggestions(query: string, by: string | undefined) {
  if (query.length < MIN_CHARS) return [];
  const [past, web] = await Promise.all([
    by ? listSessions(by, query, PAST_LIMIT).then((rows) => rows.map((row) => row.title)) : [],
    webSuggestions(query),
  ]);
  const seen = new Set<string>();
  return [
    ...past.map((text) => ({ text, past: true })),
    ...web.map((text) => ({ text, past: false })),
  ]
    .filter((suggestion) => {
      const key = suggestion.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, SUGGESTION_LIMIT);
}
