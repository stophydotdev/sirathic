import type { ThreadMessage } from "@assistant-ui/react";
import { createContext } from "react";
import { z } from "zod";
import { type Source, source } from "@sirathic/server/sources";

const sourced = z.object({ sources: z.array(source) });
const CITED_LINK = /\[\d+\]\((https?:\/\/[^)\s]+)\)/gu;

const textOf = (content: ThreadMessage["content"]) =>
  content.map((part) => (part.type === "text" ? part.text : "")).join("");

export const citedUrlsOf = (content: ThreadMessage["content"]) => [
  ...new Set(
    [...textOf(content).matchAll(CITED_LINK)].flatMap((match) => (match[1] ? [match[1]] : [])),
  ),
];

export function sourcesOf(content: ThreadMessage["content"]) {
  const found = new Map<string, Source>();
  for (const part of content) {
    if (part.type !== "tool-call") continue;
    for (const entry of sourced.safeParse(part.result).data?.sources ?? []) {
      if (!found.has(entry.url)) found.set(entry.url, entry);
    }
  }
  const cited = citedUrlsOf(content);
  const rank = (url: string) => (cited.includes(url) ? cited.indexOf(url) : cited.length);
  return [...found.values()].toSorted((a, b) => rank(a.url) - rank(b.url));
}

export function turnsOf(messages: readonly ThreadMessage[]) {
  return messages.flatMap((message, i) => {
    if (message.role !== "user") return [];
    const reply = messages[i + 1];
    return [
      {
        id: message.id,
        question: textOf(message.content),
        sources: sourcesOf(reply?.role === "assistant" ? reply.content : []),
      },
    ];
  });
}

export const SourcesContext = createContext<ReadonlyMap<string, Source>>(new Map());

export const CitationNumbers = createContext<ReadonlyMap<string, number>>(new Map());

export function siteName(url: string) {
  const host = URL.parse(url)?.hostname.replace(/^www\./, "");
  if (!host) return url;
  return host.split(".").slice(0, -1).join(".") || host;
}

export const faviconUrl = (url: string) =>
  `https://www.google.com/s2/favicons?sz=128&domain=${URL.parse(url)?.hostname ?? url}`;
