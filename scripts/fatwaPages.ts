import { fatwas, sources } from "@sirathic/db/schema";
import { z } from "zod";
import { DATA_DIR } from "./catalog";

export const RAW_DIR = `${DATA_DIR}/fatwas`;
const ATTEMPTS = 3;
const BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
export const VERSION = new Date().toISOString().slice(0, 10);

export type Fatwa = Omit<typeof fatwas.$inferInsert, "source" | "url">;
export type Site = {
  source: typeof sources.$inferInsert;
  sitemaps: string[];
  listings?: { start: string[]; follow: RegExp };
  follow?: RegExp;
  page: RegExp;
  skip?: RegExp;
  discover?: () => Promise<string[]>;
  parallel: number;
  delayMs?: number;
  parse: (markdown: string, html: string, url: string) => Fatwa | undefined;
};

const get = async (
  url: string,
  headers: Record<string, string> = {},
  attempt = 1,
): Promise<string> => {
  const response = await fetch(url, {
    headers: { "user-agent": BROWSER, "accept-language": "en", ...headers },
    signal: AbortSignal.timeout(30_000),
  }).catch((error: Error) => error);
  if (!(response instanceof Error) && response.ok) return response.text();
  const why = response instanceof Error ? response.message : `HTTP ${response.status}`;
  if (attempt === ATTEMPTS) throw new Error(`${url}: ${why}`);
  await Bun.sleep(2_000 * attempt);
  return get(url, headers, attempt + 1);
};

export const rawFile = (url: string) =>
  Bun.file(`${RAW_DIR}/${new URL(url).hostname}/${Bun.hash(url).toString(16)}.html.gz`);

export const pageHtml = async (url: string) => {
  const file = rawFile(url);
  if (await file.exists()) {
    return new TextDecoder().decode(Bun.gunzipSync(await file.bytes()));
  }
  const html = await get(url);
  await Bun.write(file, Bun.gzipSync(html));
  return html;
};

const LOC = /<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gu;

export const sitemapUrls = async (url: string, site: Site): Promise<string[]> => {
  const xml = await get(url);
  const locs = [...xml.matchAll(LOC)].map(([, loc = ""]) => loc.replaceAll("&amp;", "&"));
  if (!xml.includes("<sitemapindex")) return locs;
  const children = locs.filter((loc) => site.follow?.test(loc.split("/").at(-1) ?? loc) ?? true);
  const { delayMs } = site;
  if (!delayMs) {
    return (await Promise.all(children.map((child) => sitemapUrls(child, site)))).flat();
  }
  const inTurn = async ([child, ...rest]: string[]): Promise<string[]> => {
    if (child === undefined) return [];
    await Bun.sleep(delayMs);
    const found = await sitemapUrls(child, site);
    return [...found, ...(await inTurn(rest))];
  };
  return inTurn(children);
};

const HREF = /href="([^"#]+)"/gu;

export const listedUrls = async (site: Site): Promise<string[]> => {
  const { listings } = site;
  if (!listings) return [];
  const seen = new Set(listings.start);
  const pages = new Set<string>();
  const walk = async (frontier: string[]): Promise<void> => {
    const queue = [...frontier];
    const next: string[] = [];
    const visit = async (): Promise<void> => {
      const url = queue.shift();
      if (url === undefined) return;
      const html = await get(url).catch((error: Error) => {
        console.warn(error.message);
        return "";
      });
      for (const [, href = ""] of html.matchAll(HREF)) {
        const link = URL.parse(decode(href), url)?.href ?? "";
        const page = site.page.exec(link)?.[0];
        if (page) pages.add(page);
        else if (listings.follow.test(link) && !seen.has(link)) {
          seen.add(link);
          next.push(link);
        }
      }
      return visit();
    };
    await Promise.all(Array.from({ length: site.parallel }, visit));
    console.log(
      `${site.source.name}: ${pages.size} pages listed, ${next.length} listing pages next`,
    );
    if (next.length > 0) await walk(next);
  };
  await walk(listings.start);
  return [...pages];
};

export const clean = (markdown: string) =>
  markdown
    .replaceAll(/\[[^\]]*\]\([^)]*\/categor(?:y|ies)\/[^)]*\)/gu, "")
    .replaceAll(/!\[[^\]]*\]\([^)]*\)/gu, "")
    .replaceAll(/\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replaceAll(/\\([[\]])/gu, "$1")
    .replaceAll(/^\s*(\* \* \*|Table Of Contents)\s*$/gmu, "")
    .replaceAll(/\n{3,}/gu, "\n\n")
    .trim();

export const between = (text: string, from: RegExp, to?: RegExp) => {
  const start = from.exec(text);
  if (!start) return undefined;
  const rest = text.slice(start.index + start[0].length);
  const end = to?.exec(rest);
  return rest.slice(0, end ? end.index : undefined).trim() || undefined;
};

export const titleOf = (markdown: string) => /^# (.+)$/mu.exec(markdown)?.[1]?.trim();

export const publishedOf = (html: string) => {
  const found = /"datePublished"\s*:\s*"([^"]+)"/u.exec(html)?.[1];
  const date = found ? new Date(found) : undefined;
  return date && date.getUTCFullYear() >= 1995 ? date : undefined;
};

const SCHOOLS = ["hanafi", "maliki", "shafii", "hanbali"] as const;

export const schoolOf = (url: string) =>
  SCHOOLS.find((school) => url.includes(`/${school}/`) || url.includes(`/${school}-fiqh/`));

const WRITING_SITEMAP =
  /^(?!.*(category|post_tag|author|users|attachment|product|format|media|image|video|event|location|series|speaker|course|landing|portfolio|elementor|wpforms|give_|page-sitemap|posts-page|taxonomies|personnel|timeline|gallery|mega_menu|watch|team|topic|podcast|collections|pages|agentic|metform|wpdmpro|misc)).+$/iu;

const NOT_WRITING =
  /\/(author|authors|category|tag|topic|topics|page|feed|wp-json|download|downloads|metform-form|team|personnel|careers|donate|contact|about|about-us|courses?|events?|shop|cart|account|login|webinars?|podcasts?|videos?|watch|listen|programs?|tools|faq|privacy|terms|submissions)(\/|$)|[?#]/u;

export const decode = (text: string) =>
  text
    .replaceAll(/\\u([0-9a-f]{4})/giu, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replaceAll(/&#(\d+);/gu, (_, code: string) => String.fromCodePoint(Number(code)))
    .replaceAll(/&#x([0-9a-f]+);/giu, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");

export const plainText = (fragment: string) =>
  decode(
    fragment
      .replaceAll(/<\/p>|<br\s*\/?>/giu, "\n\n")
      .replaceAll(/<[^>]+>/gu, "")
      .replaceAll("&nbsp;", " "),
  )
    .replaceAll(/[ \t]+/gu, " ")
    .replaceAll(/\s*\n\s*/gu, "\n\n")
    .trim();

const authorOf = (html: string) => {
  const name =
    /"author"\s*:\s*\[?\s*\{[^{}]*?"name"\s*:\s*"([^"]+)"/u.exec(html)?.[1] ??
    /<meta[^>]+name="author"[^>]+content="([^"]+)"/u.exec(html)?.[1];
  return name && !name.includes("@") ? decode(name) : undefined;
};

const firstPart = (title: string | undefined) =>
  (title &&
    decode(title)
      .split(/(?:^|\s+)(?:[|\u2013\u2014-]|::)\s+/u)[0]
      ?.trim()) ||
  undefined;

const pageTitle = (markdown: string, html: string) =>
  titleOf(markdown) ??
  firstPart(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/u.exec(html)?.[1]) ??
  firstPart(/<title[^>]*>([^<]+)<\/title>/iu.exec(html)?.[1]) ??
  /^## (.+)$/mu.exec(markdown)?.[1]?.trim();

const ANSWER_MARK = /^\**Answer\**\s*:?\**\s*$|\**Answer\**\s*:\**/mu;

const article = (
  markdown: string,
  html: string,
  url: string,
  { answerMark = ANSWER_MARK, headline }: Pick<ArticleSite, "answerMark" | "headline"> = {},
): Fatwa | undefined => {
  const title = decode(headline?.exec(html)?.[1]?.trim() ?? "") || pageTitle(markdown, html);
  const body = markdown
    .replace(/^# .+$/mu, "")
    .replace(/(\n+>[^\n]*)+\s*$/u, "")
    .trim();
  if (!title || body.length < 400) return undefined;
  const split = answerMark.exec(body);
  const { hostname, pathname } = new URL(url);
  return {
    id: `${hostname.replace(/^www\./u, "")}:${pathname}`,
    school: schoolOf(url),
    answeredBy: authorOf(html),
    title,
    question: split
      ? body
          .slice(0, split.index)
          .replace(/^[\s\S]*?\**Question( Summary)?\**\s*:?\**\s*/u, "")
          .trim() || undefined
      : undefined,
    answer: split ? body.slice(split.index + split[0].length).trim() : body,
    publishedAt: publishedOf(html),
  };
};

type ArticleSite = {
  name: string;
  url: string;
  credit: string;
  sitemaps: string[];
  listings?: Site["listings"];
  discover?: Site["discover"];
  page: RegExp;
  skip?: RegExp;
  follow?: RegExp;
  answerMark?: RegExp;
  headline?: RegExp;
  parallel?: number;
  delayMs?: number;
  school?: Fatwa["school"];
  answeredBy?: (markdown: string) => string | undefined;
};

export const articleSite = ({
  name,
  url,
  credit,
  sitemaps,
  listings,
  discover,
  page,
  skip = NOT_WRITING,
  follow = WRITING_SITEMAP,
  answerMark,
  headline,
  parallel = 2,
  delayMs,
  school,
  answeredBy,
}: ArticleSite): Site => ({
  source: {
    name,
    url,
    version: VERSION,
    license: "Not reviewed. Confirm reuse terms before launch",
    credit,
  },
  sitemaps,
  listings,
  discover,
  follow,
  page,
  skip,
  parallel,
  delayMs,
  parse: (markdown, html, pageUrl) => {
    const found = article(markdown, html, pageUrl, { answerMark, headline });
    return (
      found && {
        ...found,
        school: school ?? found.school,
        answeredBy: answeredBy?.(markdown) ?? found.answeredBy,
      }
    );
  },
});

export const by = (name: string) => () => name;

export const ISLAMQA_ANSWER = /^https:\/\/islamqa\.info\/([a-z]{2})\/answers\/(\d+)/u;

export const headingLine = (label: string | undefined, end = "\\s*$") =>
  label ? new RegExp(`^## ${RegExp.escape(label.trim())}${end}`, "mu") : /$^/u;

const AMJA_PAGE = 1_000;

const AMJA_FATWAS = z.object({
  recordsTotal: z.number(),
  data: z.array(z.object({ data: z.object({ id: z.number(), slug: z.string() }) })),
});

export const amjaFatwas = async (lang: "en" | "ar", start = 0): Promise<string[]> => {
  const query = `draw=1&start=${start}&length=${AMJA_PAGE}&order[0][column]=0&order[0][dir]=asc&columns[0][data]=data&columns[0][name]=id&columns[0][searchable]=true&columns[0][orderable]=true&search[value]=`;
  const { recordsTotal, data } = AMJA_FATWAS.parse(
    JSON.parse(
      await get(`https://www.amjaonline.org/fatwa/${lang}?${query}`, {
        "x-requested-with": "XMLHttpRequest",
      }),
    ),
  );
  const urls = data.map(
    ({ data: { id, slug } }) => `https://www.amjaonline.org/fatwa/${lang}/${id}/${slug}`,
  );
  if (start + AMJA_PAGE >= recordsTotal) return urls;
  await Bun.sleep(1_000);
  return [...urls, ...(await amjaFatwas(lang, start + AMJA_PAGE))];
};

const DARULIFTAA_PAGE = 100;

const DARULIFTAA_QUESTIONS = z.object({
  count: z.number(),
  results: z.array(z.object({ detail_url: z.string(), status: z.string() })),
});

const darulIftaaCategory = async (category: string, offset = 0): Promise<string[]> => {
  const { count, results } = DARULIFTAA_QUESTIONS.parse(
    JSON.parse(
      await get(
        `https://daruliftaa.us/api/v1/questions/fatwas/${category}/questions/?limit=${DARULIFTAA_PAGE}&offset=${offset}`,
      ),
    ),
  );
  const urls = results
    .filter(({ status }) => status === "Complete")
    .map(({ detail_url }) => `https://daruliftaa.us${detail_url}`);
  if (offset + DARULIFTAA_PAGE >= count) return urls;
  return [...urls, ...(await darulIftaaCategory(category, offset + DARULIFTAA_PAGE))];
};

export const darulIftaaFatwas = async () => {
  const sitemap = await get("https://daruliftaa.us/sitemap.xml");
  const categories = [...sitemap.matchAll(/\/fatwas\/category\/([^/]+)\//gu)].map(
    ([, slug = ""]) => slug,
  );
  return (await Promise.all(categories.map((slug) => darulIftaaCategory(slug)))).flat();
};

const FATWAISLAM_FATWA = "https://fatwaislam.com/fis/index.cfm?scn=fd&ID=";

export const fatwaIslamFatwas = async () => {
  const latest = await get("https://fatwaislam.com/fis/index.cfm?scn=firstpage_latest");
  const newest = Math.max(
    ...[...latest.matchAll(/scn=fd&(?:amp;)?ID=(\d+)/gu)].map(([, id]) => Number(id)),
  );
  return Array.from({ length: newest }, (_, index) => `${FATWAISLAM_FATWA}${index + 1}`);
};
