import type { z } from "zod";
import { blockOf, collectionSlugs, parseHadithRef, type CollectionSlug } from "./resolve";
import {
  curatedFile,
  hadithBlockFile,
  aliasIndexFile,
  quranSurahFile,
  translationSurahFile,
  type Source,
} from "./schema";

type Env = { DATA: R2Bucket };

type Context = { request: Request; env: Env; url: URL };

const cacheControl = "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400";

const baseHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-expose-headers": "etag",
  "x-content-type-options": "nosniff",
};

const json = <Body>(body: Body, status = 200) =>
  Response.json(body, {
    status,
    headers: { ...baseHeaders, "cache-control": status === 200 ? cacheControl : "no-store" },
  });

const failure = (status: number, error: string) => json({ error }, status);

const stream = async ({ request, env }: Context, key: string) => {
  const object = await env.DATA.get(key);
  if (!object) return failure(404, "not found");
  const headers = new Headers({ ...baseHeaders, "cache-control": cacheControl });
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  if (request.headers.get("if-none-match") === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(object.body, { headers });
};

const readFile = async <Schema extends z.ZodType>(env: Env, key: string, schema: Schema) => {
  const object = await env.DATA.get(key);
  if (!object) return null;
  return schema.parse(await object.json());
};

const mergeSources = (lists: Source[][]) => [
  ...new Map(lists.flat().map((entry) => [entry.id, entry])).values(),
];

const numberParam = (value: string | null) => (value && /^\d{1,4}$/.test(value) ? value : null);

const verse = async (context: Context, surah: string, ayah: string) => {
  const file = await readFile(context.env, `quran/surahs/${surah}.json`, quranSurahFile);
  const found = file?.data.verses.find((entry) => entry.ayah === Number(ayah));
  if (!file || !found) return failure(404, "verse not found");
  const keys = (context.url.searchParams.get("translations") ?? "").split(",").filter(Boolean);
  if (!keys.every((key) => /^[a-z0-9_]+$/.test(key))) return failure(400, "bad translation key");
  const files = await Promise.all(
    keys.map((key) =>
      readFile(context.env, `quran/translations/${key}/${surah}.json`, translationSurahFile),
    ),
  );
  const translations = [];
  for (const [index, translated] of files.entries()) {
    if (!translated) return failure(404, `unknown translation: ${keys[index]}`);
    const row = translated.data.verses.find((entry) => entry.ayah === Number(ayah));
    translations.push({
      key: translated.data.key,
      language: translated.data.language,
      title: translated.data.title,
      version: translated.data.version,
      translation: row?.translation ?? null,
      footnotes: row?.footnotes ?? null,
    });
  }
  return json({
    data: { ...found, surahName: file.data.englishName, translations },
    sources: mergeSources([
      file.sources,
      ...files.flatMap((entry) => (entry ? [entry.sources] : [])),
    ]),
  });
};

const verseList = (context: Context) => {
  const { searchParams } = context.url;
  const lists = [
    ["juz", numberParam(searchParams.get("juz"))],
    ["page", numberParam(searchParams.get("page"))],
    ["hizb", numberParam(searchParams.get("hizb"))],
  ] as const;
  const chosen = lists.filter(([, value]) => value);
  const [first] = chosen;
  if (chosen.length !== 1 || !first?.[1])
    return failure(400, "pass exactly one of juz, page or hizb");
  return stream(context, `quran/${first[0]}/${first[1]}.json`);
};

const hadith = async (context: Context, collection: CollectionSlug, number: string) => {
  const file = await readFile(
    context.env,
    `hadith/${collection}/${blockOf(number)}.json`,
    hadithBlockFile,
  );
  const record = file?.data.hadith.find((entry) => entry.number === number);
  if (!file || !record) return failure(404, "hadith not found");
  return json({ data: record, sources: file.sources });
};

const resolve = async (context: Context) => {
  const ref = context.url.searchParams.get("ref") ?? "";
  const parsed = parseHadithRef(ref);
  if (!parsed) {
    return failure(
      400,
      'unrecognised reference, try "muslim 2291a" or "bukhari, book 1, hadith 1"',
    );
  }
  const aliases = await readFile(
    context.env,
    `hadith/${parsed.collection}/aliases.json`,
    aliasIndexFile,
  );
  const alias = parsed.kind === "number" ? parsed.number : `${parsed.book}:${parsed.hadith}`;
  const number = aliases?.[alias] ?? (parsed.kind === "number" ? parsed.number : null);
  if (!number) return failure(404, "no verified hadith has this reference");
  const file = await readFile(
    context.env,
    `hadith/${parsed.collection}/${blockOf(number)}.json`,
    hadithBlockFile,
  );
  const record = file?.data.hadith.find((entry) => entry.number === number);
  if (!file || !record?.verified) {
    return failure(404, "no verified hadith has this reference, two sources must agree on it");
  }
  return json({ data: { query: ref, ...record }, sources: file.sources });
};

const curated = async (context: Context, id: string) => {
  const languages = (context.url.searchParams.get("lang") ?? "").split(",").filter(Boolean);
  if (languages.length === 0) return stream(context, `hadith/curated/${id}.json`);
  const file = await readFile(context.env, `hadith/curated/${id}.json`, curatedFile);
  if (!file) return failure(404, "hadith not found");
  const missing = languages.filter((code) => code !== "ar" && !file.data.languages.includes(code));
  if (missing.length > 0) {
    return failure(
      404,
      `no ${missing.join(", ")} translation, available: ar, ${file.data.languages.join(", ")}`,
    );
  }
  const translations = Object.fromEntries(
    Object.entries(file.data.translations).filter(([code]) => languages.includes(code)),
  );
  return json({ data: { ...file.data, translations }, sources: file.sources });
};

type Route = {
  pattern: RegExp;
  run: (context: Context, match: string[]) => Promise<Response> | Response;
};

const files = (key: string) => (context: Context) => stream(context, key);

const routes: Route[] = [
  { pattern: /^\/v1\/?$/, run: files("index.json") },
  { pattern: /^\/v1\/sources$/, run: files("sources.json") },
  { pattern: /^\/v1\/downloads$/, run: files("downloads.json") },
  {
    pattern: /^\/v1\/downloads\/([\w.-]+)$/,
    run: (context, [, name = ""]) => stream(context, `downloads/${name}`),
  },
  { pattern: /^\/v1\/quran\/surahs$/, run: files("quran/surahs.json") },
  {
    pattern: /^\/v1\/quran\/surahs\/(\d{1,3})$/,
    run: (context, [, surah = ""]) => stream(context, `quran/surahs/${surah}.json`),
  },
  { pattern: /^\/v1\/quran\/verses$/, run: verseList },
  {
    pattern: /^\/v1\/quran\/verses\/(\d{1,3}):(\d{1,3})$/,
    run: (context, [, surah = "", ayah = ""]) => verse(context, surah, ayah),
  },
  { pattern: /^\/v1\/quran\/translations$/, run: files("quran/translations.json") },
  {
    pattern: /^\/v1\/quran\/translations\/([a-z0-9_]+)\/(\d{1,3})$/,
    run: (context, [, key = "", surah = ""]) =>
      stream(context, `quran/translations/${key}/${surah}.json`),
  },
  { pattern: /^\/v1\/hadith\/collections$/, run: files("hadith/collections.json") },
  { pattern: /^\/v1\/hadith\/unverified$/, run: files("hadith/unverified.json") },
  { pattern: /^\/v1\/hadith\/resolve$/, run: resolve },
  { pattern: /^\/v1\/hadith\/curated\/categories$/, run: files("hadith/curated/categories.json") },
  {
    pattern: /^\/v1\/hadith\/curated\/(\d{1,6})$/,
    run: (context, [, id = ""]) => curated(context, id),
  },
  {
    pattern: /^\/v1\/hadith\/([a-z]+)\/([A-Za-z0-9.-]+)$/,
    run: (context, [, collection = "", number = ""]) => {
      const slug = collectionSlugs.find((name) => name === collection);
      return slug
        ? hadith(context, slug, number.toLowerCase())
        : failure(404, "unknown collection");
    },
  },
];

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: baseHeaders });
    if (request.method !== "GET" && request.method !== "HEAD") return failure(405, "read only");
    const url = new URL(request.url);
    const context = { request, env, url } satisfies Context;
    for (const { pattern, run } of routes) {
      const match = pattern.exec(url.pathname);
      if (match) return run(context, match);
    }
    return failure(404, "not found, see /v1");
  },
} satisfies ExportedHandler<Env>;
