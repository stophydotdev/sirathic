import type { ChatMessage } from "@sirathic/server/messages";
import { type Source, source } from "@sirathic/server/sources";
import { z } from "zod";

const sourced = z.object({ sources: z.array(source) });
const CITED_LINK = /\[\d+\]\((https?:\/\/[^)\s]+)\)/gu;

export const textOf = (message: ChatMessage) =>
  message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");

export function sourcesOf(message: ChatMessage) {
  const found = new Map<string, Source>();
  for (const part of message.parts) {
    if (!("output" in part) || part.state !== "output-available") continue;
    for (const entry of sourced.safeParse(part.output).data?.sources ?? []) {
      if (!found.has(entry.url)) found.set(entry.url, entry);
    }
  }
  const cited = [...new Set([...textOf(message).matchAll(CITED_LINK)].map((m) => m[1]))];
  const rank = (url: string) => (cited.includes(url) ? cited.indexOf(url) : cited.length);
  return [...found.values()].toSorted((a, b) => rank(a.url) - rank(b.url));
}

export const relatedOf = (message: ChatMessage) =>
  message.parts.flatMap((part) => (part.type === "data-related" ? part.data.questions : []));

export function siteName(url: string) {
  const host = URL.parse(url)?.hostname.replace(/^www\./, "");
  if (!host) return url;
  return host.split(".").slice(0, -1).join(".") || host;
}
