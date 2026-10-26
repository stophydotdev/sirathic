import type { ThreadMessage } from "@assistant-ui/react";
import { createContext } from "react";
import { z } from "zod";
import { type Source, source } from "@sirathic/server/sources";
import { researchOf } from "@/components/research";

const sourced = z.object({ sources: z.array(source) });
const CITED_LINK = /\[\d+\]\((https?:\/\/[^)\s]+)\)/gu;

const textOf = (content: ThreadMessage["content"]) =>
  content.map((part) => (part.type === "text" ? part.text : "")).join("");

const citedUrlsOf = (content: ThreadMessage["content"]) => [
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

export function citedSourcesOf(content: ThreadMessage["content"]) {
  const cited = new Set(citedUrlsOf(content));
  return sourcesOf(content).filter((entry) => cited.has(entry.url));
}

export function turnsOf(messages: readonly ThreadMessage[]) {
  return messages.flatMap((message, i) => {
    if (message.role !== "user") return [];
    const reply = messages[i + 1];
    const content = reply?.role === "assistant" ? reply.content : [];
    return [
      {
        id: message.id,
        question: textOf(message.content),
        queries: [
          ...new Set(
            researchOf(content, false).flatMap((step) =>
              step.kind === "searches" ? step.queries : [],
            ),
          ),
        ],
        sources: sourcesOf(content),
        cited: citedSourcesOf(content),
      },
    ];
  });
}

export const SourcesContext = createContext<ReadonlyMap<string, Source>>(new Map());

export function siteName(url: string) {
  const host = URL.parse(url)?.hostname.replace(/^www\./, "");
  if (!host) return url;
  return host.split(".").slice(0, -1).join(".") || host;
}

export const faviconUrl = (url: string) =>
  `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(URL.parse(url)?.hostname ?? url)}`;
