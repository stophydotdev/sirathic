import type { ThreadMessage } from "@assistant-ui/react";
import { z } from "zod";

const SEARCHES = new Set(["webSearch", "searchSources", "newsSearch", "redditSearch"]);

const toolInput = z
  .object({
    query: z.string(),
    url: z.string(),
    text: z.string(),
    name: z.string(),
    place: z.string(),
    ticker: z.string(),
    expression: z.string(),
  })
  .partial();

const searchArgs = z
  .object({ queries: z.array(z.string()), arabic: z.array(z.string()) })
  .partial();

export type ResearchStep =
  | { kind: "think"; text: string }
  | { kind: "search"; queries: string[] }
  | { kind: "read"; urls: string[] }
  | { kind: "tool"; tool: string; detail: string };

export function stepsOf(parts: readonly ThreadMessage["content"][number][]) {
  const steps: ResearchStep[] = [];
  for (const part of parts) {
    const last = steps.at(-1);
    if (part.type === "reasoning") {
      const title = part.text.trim().split("\n")[0]?.replaceAll("*", "").trim();
      if (title) steps.push({ kind: "think", text: title });
      continue;
    }
    if (part.type !== "tool-call") continue;
    if (part.toolName === "search") {
      const args = searchArgs.safeParse(part.args).data;
      const queries = [...(args?.queries ?? []), ...(args?.arabic ?? [])];
      if (queries.length === 0) continue;
      if (last?.kind === "search") last.queries.push(...queries);
      else steps.push({ kind: "search", queries });
      continue;
    }
    const input = toolInput.safeParse(part.args).data ?? {};
    if (SEARCHES.has(part.toolName) && input.query) {
      if (last?.kind === "search") last.queries.push(input.query);
      else steps.push({ kind: "search", queries: [input.query] });
    } else if (part.toolName === "webFetch" && input.url) {
      if (last?.kind === "read") last.urls.push(input.url);
      else steps.push({ kind: "read", urls: [input.url] });
    } else {
      const detail =
        input.query ??
        input.text ??
        input.name ??
        input.place ??
        input.ticker ??
        input.expression ??
        "";
      steps.push({ kind: "tool", tool: part.toolName, detail });
    }
  }
  return steps;
}

const operator = /(^|\s)-?(site|inurl|intitle|intext|filetype|before|after|source):\S*/gi;

export function readableQuery(query: string) {
  const plain = query
    .replace(operator, " ")
    .replace(/(^|\s)-\S+/g, " ")
    .replace(/["“”()]/g, "")
    .replace(/\bOR\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain || query;
}
