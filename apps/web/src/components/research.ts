import type { ThreadMessage } from "@assistant-ui/react";
import { CONNECTOR_IDS } from "@sirathic/server/catalog";
import { currentToolName } from "@sirathic/server/messages";
import { z } from "zod";

type Part = ThreadMessage["content"][number];

const SEARCH_SOURCES = ["quran", "hadith", "fiqh", "fatwa", "web", "news"] as const;
export type SearchSource = (typeof SEARCH_SOURCES)[number];

const searchArgs = z
  .object({ queries: z.array(z.string()), arabic: z.array(z.string()) })
  .partial();

const page = z.object({ title: z.string(), url: z.string() });
const searchOutput = z.object({
  results: z
    .object({
      quran: z.array(z.object({ ref: z.string() })).catch([]),
      hadith: z.array(z.object({ ref: z.string(), grade: z.string().nullable() })).catch([]),
      fiqh: z.array(z.object({ work: z.string(), school: z.string() })).catch([]),
      fatwa: z.array(z.object({ title: z.string(), site: z.string() })).catch([]),
      web: z.array(page).catch([]),
      news: z.array(page).catch([]),
    })
    .partial(),
  sources: z.array(page).catch([]),
});

const quranArgs = z.object({
  surah: z.number(),
  from: z.number().optional(),
  to: z.number().optional(),
});
const fetchArgs = z.union([
  z.object({ urls: z.array(z.string()) }),
  z.object({ url: z.string() }).transform(({ url }) => ({ urls: [url] })),
]);
const fetchResult = z.object({
  pages: z.array(z.object({ url: z.string(), error: z.string().optional() })),
});
const queryArgs = z.object({ query: z.string() });
const codeArgs = z
  .union([
    z
      .object({ type: z.literal("programmatic-tool-call"), code: z.string() })
      .transform((input) => input.code),
    z
      .object({ type: z.literal("bash_code_execution"), command: z.string() })
      .transform((input) => input.command),
  ])
  .catch("");
const LEGACY_SEARCHES = new Set([
  "quranSearch",
  "hadithSearch",
  "fiqhSearch",
  "fatwaSearch",
  "webSearch",
  "newsSearch",
]);

export type Read = { source: SearchSource; title: string; detail?: string; url?: string };

export type PluginCall = { tool: string; detail: string; done: boolean };

export type ResearchStep =
  | { kind: "think"; text: string; live: boolean }
  | { kind: "searches"; queries: string[]; results: Read[]; done: boolean }
  | { kind: "browse"; url: string; failed: boolean }
  | { kind: "verses"; title: string; url: string }
  | { kind: "code"; code: string }
  | { kind: "tool"; tool: string; detail: string }
  | { kind: "plugin"; plugin: string; calls: PluginCall[] };

const hostOf = (url: string) => URL.parse(url)?.hostname.replace(/^www\./u, "") ?? url;
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const VERSE_REF = /Quran (\d+):(\d+)/u;

const CUSTOM_PLUGIN = /^custom-[a-z0-9]{8}(?=_)/u;

const pluginOf = (tool: string) =>
  CONNECTOR_IDS.find((id) => tool.startsWith(`${id}_`)) ?? CUSTOM_PLUGIN.exec(tool)?.[0];

const titleOf = (plugin: string, tool: string) => {
  const words = tool
    .slice(plugin.length + 1)
    .split(/[_-]+/u)
    .filter((word) => word && word.toLowerCase() !== plugin);
  return words.length > 0 ? words.map(capitalized).join(" ") : tool;
};

const callDetail = z
  .looseObject({ query: z.string().optional() })
  .catch({})
  .transform(
    (fields) =>
      [fields.query, ...Object.values(fields)]
        .map((value) => z.string().safeParse(value).data)
        .find(Boolean) ?? "",
  );

const sentencesOf = (text: string) =>
  text
    .replaceAll(/[*#`]/gu, "")
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const WORD_COUNT = /\bword count\b|\d\s*words\b/iu;

const PROGRESS_PREFIX =
  /^(?:now\s+|next\s+|[^,]{0,40},\s+)?I(?:['’]m| am)\s+(?:also\s+|now\s+|still\s+)?(?=\w+ing\b)/iu;

const headlineOf = (paragraph: string) => {
  const sentence = sentencesOf(paragraph).find((line) => !/^the user\b/iu.test(line)) ?? "";
  const [clause = ""] = sentence
    .replace(PROGRESS_PREFIX, "")
    .replaceAll(/\s*\[\d+\]/gu, "")
    .split(/[:;(\u2014]| - |, (?=\w+ing\b|which\b|where\b|while\b|since\b|plus\b|so\b)/u);
  const headline = capitalized(clause.trim().replace(/[.,]$/u, ""));
  return /^\w+ing\b/u.test(headline) && !WORD_COUNT.test(headline) ? headline : "";
};

const thoughtOf = (text: string, live: boolean) => {
  const paragraphs = text.split(/\n\s*\n/u).filter((paragraph) => paragraph.trim());
  const finished = live ? paragraphs.slice(0, -1) : paragraphs;
  return finished.map(headlineOf).findLast(Boolean) ?? "";
};

function readsOf({ results, sources }: z.infer<typeof searchOutput>): Read[] {
  const linkOf = (title: string) =>
    sources.find((found) => found.title === title || found.title.startsWith(`${title}:`))?.url;
  return [
    ...(results.quran ?? []).map(({ ref }): Read => {
      const [, surah, ayah] = VERSE_REF.exec(ref) ?? [];
      return {
        source: "quran",
        title: ref,
        url: surah ? `https://quran.com/${surah}/${ayah}` : undefined,
      };
    }),
    ...(results.hadith ?? []).map(({ ref, grade }): Read => ({
      source: "hadith",
      title: ref,
      detail: grade?.split(" (")[0],
      url: linkOf(ref),
    })),
    ...(results.fiqh ?? []).map(({ work, school }): Read => ({
      source: "fiqh",
      title: work,
      detail: capitalized(school),
    })),
    ...(results.fatwa ?? []).map(({ title, site }): Read => ({
      source: "fatwa",
      title,
      detail: site.split(", ")[0],
      url: linkOf(title),
    })),
    ...(results.web ?? []).map(({ title, url }): Read => ({
      source: "web",
      title,
      detail: hostOf(url),
      url,
    })),
    ...(results.news ?? []).map(({ title, url }): Read => ({
      source: "news",
      title,
      detail: hostOf(url),
      url,
    })),
  ];
}

export function researchOf(parts: readonly Part[], thinkingLive: boolean) {
  const steps: ResearchStep[] = [];
  parts.forEach((part, i) => {
    if (part.type === "reasoning") {
      const live = thinkingLive && i === parts.length - 1;
      const text = thoughtOf(part.text, live);
      if (live || text) steps.push({ kind: "think", text, live });
      return;
    }
    if (part.type !== "tool-call") return;
    const toolName = currentToolName(part.toolName);
    if (toolName === "search_web" || LEGACY_SEARCHES.has(toolName)) {
      const { queries = [], arabic = [] } = searchArgs.safeParse(part.args).data ?? {};
      const legacy = queryArgs.safeParse(part.args).data?.query;
      const asked = legacy ? [legacy] : [...queries, ...arabic];
      const output = searchOutput.safeParse(part.result).data;
      const found = output ? readsOf(output) : [];
      const done = part.result !== undefined;
      const batch = steps.at(-1);
      if (batch?.kind === "searches") {
        batch.queries.push(...asked);
        batch.results.push(...found);
        batch.done &&= done;
      } else if (asked.length > 0) {
        steps.push({ kind: "searches", queries: asked, results: found, done });
      }
      return;
    }
    if (toolName === "fetch_url") {
      const { urls = [] } = fetchArgs.safeParse(part.args).data ?? {};
      const unread = new Set(
        (fetchResult.safeParse(part.result).data?.pages ?? []).flatMap((entry) =>
          entry.error ? [entry.url] : [],
        ),
      );
      for (const url of urls) {
        steps.push({ kind: "browse", url, failed: part.isError === true || unread.has(url) });
      }
      return;
    }
    if (part.toolName === "code_execution") {
      steps.push({ kind: "code", code: codeArgs.parse(part.args) });
      return;
    }
    if (toolName === "get_verses") {
      const verses = quranArgs.safeParse(part.args).data;
      if (!verses) return;
      const from = verses.from ?? 1;
      const range = verses.to && verses.to !== from ? `${from}-${verses.to}` : `${from}`;
      steps.push({
        kind: "verses",
        title: `Quran ${verses.surah}:${range}`,
        url: `https://quran.com/${verses.surah}/${from}`,
      });
      return;
    }
    const plugin = pluginOf(part.toolName);
    if (plugin) {
      const call = {
        tool: titleOf(plugin, part.toolName),
        detail: callDetail.parse(part.args),
        done: part.result !== undefined,
      };
      const group = steps.at(-1);
      if (group?.kind === "plugin" && group.plugin === plugin) group.calls.push(call);
      else steps.push({ kind: "plugin", plugin, calls: [call] });
      return;
    }
    steps.push({
      kind: "tool",
      tool: toolName,
      detail: queryArgs.safeParse(part.args).data?.query ?? "",
    });
  });
  return steps;
}
