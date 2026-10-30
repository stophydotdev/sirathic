import { unwrappedCitations } from "@sirathic/app/citations";
import { CONNECTORS } from "@sirathic/server/catalog";
import { type ChatMessage, messageText } from "@sirathic/server/messages";
import { type Source, source } from "@sirathic/server/sources";
import { z } from "zod";

const sourced = z.object({ sources: z.array(source) });
const CITED_LINK = /\[\d+\]\((https?:\/\/[^)\s]+)\)/gu;

export function sourcesOf(message: ChatMessage) {
  const found = new Map<string, Source>();
  for (const part of message.parts) {
    if (!("output" in part) || part.state !== "output-available") continue;
    for (const entry of sourced.safeParse(part.output).data?.sources ?? []) {
      if (!found.has(entry.url)) found.set(entry.url, entry);
    }
  }
  const cited = new Set([...messageText(message).matchAll(CITED_LINK)].flatMap((m) => m[1] ?? []));
  return [
    ...[...cited].flatMap((url) => found.get(url) ?? []),
    ...[...found.values()].filter((entry) => !cited.has(entry.url)),
  ];
}

export const relatedOf = (message: ChatMessage) =>
  message.parts.flatMap((part) => (part.type === "data-related" ? part.data.questions : []));

export const faviconUrl = (url: string) =>
  `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(URL.parse(url)?.hostname ?? url)}`;

const CITATION_RUN = /(?:\s*\[\d+\]\((https?:\/\/[^)\s]+)\))+/gu;

const urlsIn = (run: string) => [...run.matchAll(CITED_LINK)].flatMap((link) => link[1] ?? []);

export const withoutCitations = (text: string) =>
  unwrappedCitations(text).replace(CITATION_RUN, "");

export const groupedCitations = (text: string) => {
  let run = 0;
  return unwrappedCitations(text).replace(
    CITATION_RUN,
    (found) => ` [c${run++}](${urlsIn(found)[0] ?? ""})`,
  );
};

export const citationRuns = (text: string) =>
  [...text.matchAll(CITATION_RUN)].map((found) => urlsIn(found[0]));

export const pluginIcon = (url: string) => {
  const known = Object.values(CONNECTORS).find((connector) => connector.url === url);
  return known && "icon" in known
    ? known.icon
    : faviconUrl(`https://${URL.parse(url)?.hostname.split(".").slice(-2).join(".") ?? url}`);
};

export function siteName(url: string) {
  const parts = (URL.parse(url)?.hostname.replace(/^www\./, "") ?? url).split(".");
  return (parts.length > 2 ? parts.at(-2) : parts[0]) ?? url;
}
