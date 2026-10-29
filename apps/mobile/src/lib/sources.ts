import { CONNECTORS } from "@sirathic/server/catalog";
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
  const cited = new Set([...textOf(message).matchAll(CITED_LINK)].flatMap((m) => m[1] ?? []));
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
const CITATION_LINK = /\[\d+\]\(/gu;

export const withoutCitations = (text: string) => text.replace(CITATION_RUN, "");

export const groupedCitations = (text: string) =>
  text.replace(CITATION_RUN, (run, first: string) => {
    const extra = (run.match(CITATION_LINK)?.length ?? 1) - 1;
    return ` [${extra > 0 ? `+${extra}` : "0"}](${first})`;
  });

export const pluginIcon = (url: string) => {
  const known = Object.values(CONNECTORS).find((connector) => connector.url === url);
  return known && "icon" in known
    ? known.icon
    : faviconUrl(`https://${URL.parse(url)?.hostname.split(".").slice(-2).join(".") ?? url}`);
};

export function siteName(url: string) {
  const host = URL.parse(url)?.hostname.replace(/^www\./, "");
  if (!host) return url;
  return host.split(".").slice(0, -1).join(".") || host;
}
