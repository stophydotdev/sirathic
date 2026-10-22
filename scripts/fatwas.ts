import { mkdir } from "node:fs/promises";
import { htmlToMarkdown } from "@sirathic/core/web/htmlToMarkdown";
import { db } from "@sirathic/db";
import { fatwas, sources } from "@sirathic/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { DATA_DIR, FATWA_MIRRORS } from "./catalog";

const DRY = process.argv.includes("--dry");
const SAMPLES = process.argv.filter((arg) => arg.startsWith("https://"));
const LIMIT = Number(
  process.argv.find((arg) => arg.startsWith("--limit="))?.slice(8) ?? Infinity,
);
const ONLY = process.argv
  .find((arg) => arg.startsWith("--sites="))
  ?.slice(8)
  .split(",");
const CHUNK_CHARS = 6_000;
const RAW_DIR = `${DATA_DIR}/fatwas`;
const BATCH_SIZE = 100;
const ATTEMPTS = 3;
const BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const SITES_AT_ONCE = 3;
const SITEMAPS_AT_ONCE = 4;
const VERSION = new Date().toISOString().slice(0, 10);

type Fatwa = Omit<typeof fatwas.$inferInsert, "source" | "url">;
type Site = {
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
  const why =
    response instanceof Error ? response.message : `HTTP ${response.status}`;
  if (attempt === ATTEMPTS) throw new Error(`${url}: ${why}`);
  await Bun.sleep(2_000 * attempt);
  return get(url, headers, attempt + 1);
};

const inPool = async <T, R>(
  items: T[],
  size: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = [];
  const queue = items.entries();
  const worker = async (): Promise<void> => {
    const next = queue.next();
    if (next.done) return;
    const [index, item] = next.value;
    results[index] = await run(item);
    return worker();
  };
  await Promise.all(Array.from({ length: size }, worker));
  return results;
};

const rawFile = (url: string) =>
  Bun.file(
    `${RAW_DIR}/${new URL(url).hostname}/${Bun.hash(url).toString(16)}.html.gz`,
  );

const pageHtml = async (url: string) => {
  const file = rawFile(url);
  if (await file.exists()) {
    return new TextDecoder().decode(Bun.gunzipSync(await file.bytes()));
  }
  const html = await get(url);
  await Bun.write(file, Bun.gzipSync(html));
  return html;
};

const LOC = /<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gu;

const sitemapUrls = async (url: string, site: Site): Promise<string[]> => {
  const xml = await get(url);
  const locs = [...xml.matchAll(LOC)].map(([, loc = ""]) =>
    loc.replaceAll("&amp;", "&"),
  );
  if (!xml.includes("<sitemapindex")) return locs;
  const children = locs.filter(
    (loc) => site.follow?.test(loc.split("/").at(-1) ?? loc) ?? true,
  );
  const { delayMs } = site;
  if (!delayMs) {
    return (
      await inPool(children, SITEMAPS_AT_ONCE, (child) =>
        sitemapUrls(child, site),
      )
    ).flat();
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

const listedUrls = async (site: Site): Promise<string[]> => {
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

const clean = (markdown: string) =>
  markdown
    .replaceAll(/\[[^\]]*\]\([^)]*\/categor(?:y|ies)\/[^)]*\)/gu, "")
    .replaceAll(/!\[[^\]]*\]\([^)]*\)/gu, "")
    .replaceAll(/\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replaceAll(/\\([[\]])/gu, "$1")
    .replaceAll(/^\s*(\* \* \*|Table Of Contents)\s*$/gmu, "")
    .replaceAll(/\n{3,}/gu, "\n\n")
    .trim();

const between = (text: string, from: RegExp, to?: RegExp) => {
  const start = from.exec(text);
  if (!start) return undefined;
  const rest = text.slice(start.index + start[0].length);
  const end = to?.exec(rest);
  return rest.slice(0, end ? end.index : undefined).trim() || undefined;
};

const titleOf = (markdown: string) => /^# (.+)$/mu.exec(markdown)?.[1]?.trim();

const publishedOf = (html: string) => {
  const found = /"datePublished"\s*:\s*"([^"]+)"/u.exec(html)?.[1];
  const date = found ? new Date(found) : undefined;
  return date && date.getUTCFullYear() >= 1995 ? date : undefined;
};

const SCHOOLS = ["hanafi", "maliki", "shafii", "hanbali"] as const;

const schoolOf = (url: string) =>
  SCHOOLS.find(
    (school) => url.includes(`/${school}/`) || url.includes(`/${school}-fiqh/`),
  );

const WRITING_SITEMAP =
  /^(?!.*(category|post_tag|author|users|attachment|product|format|media|image|video|event|location|series|speaker|course|landing|portfolio|elementor|wpforms|give_|page-sitemap|posts-page|taxonomies|personnel|timeline|gallery|mega_menu|watch|team|topic|podcast|collections|pages|agentic|metform|wpdmpro|misc)).+$/iu;

const NOT_WRITING =
  /\/(author|authors|category|tag|topic|topics|page|feed|wp-json|download|downloads|metform-form|team|personnel|careers|donate|contact|about|about-us|courses?|events?|shop|cart|account|login|webinars?|podcasts?|videos?|watch|listen|programs?|tools|faq|privacy|terms|submissions)(\/|$)|[?#]/u;

const decode = (text: string) =>
  text
    .replaceAll(/\\u([0-9a-f]{4})/giu, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replaceAll(/&#(\d+);/gu, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replaceAll(/&#x([0-9a-f]+);/giu, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");

const plainText = (fragment: string) =>
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
  firstPart(
    /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/u.exec(html)?.[1],
  ) ??
  firstPart(/<title[^>]*>([^<]+)<\/title>/iu.exec(html)?.[1]) ??
  /^## (.+)$/mu.exec(markdown)?.[1]?.trim();

const ANSWER_MARK = /^\**Answer\**\s*:?\**\s*$|\**Answer\**\s*:\**/mu;

const article = (
  markdown: string,
  html: string,
  url: string,
  {
    answerMark = ANSWER_MARK,
    headline,
  }: Pick<ArticleSite, "answerMark" | "headline"> = {},
): Fatwa | undefined => {
  const title =
    decode(headline?.exec(html)?.[1]?.trim() ?? "") ||
    pageTitle(markdown, html);
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

const articleSite = ({
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

const by = (name: string) => () => name;

const ISLAMQA_ANSWER = /^https:\/\/islamqa\.info\/([a-z]{2})\/answers\/(\d+)/u;

const headingLine = (label: string | undefined, end = "\\s*$") =>
  label ? new RegExp(`^## ${RegExp.escape(label.trim())}${end}`, "mu") : /$^/u;

const AMJA_PAGE = 1_000;

const AMJA_FATWAS = z.object({
  recordsTotal: z.number(),
  data: z.array(
    z.object({ data: z.object({ id: z.number(), slug: z.string() }) }),
  ),
});

const amjaFatwas = async (lang: "en" | "ar", start = 0): Promise<string[]> => {
  const query = `draw=1&start=${start}&length=${AMJA_PAGE}&order[0][column]=0&order[0][dir]=asc&columns[0][data]=data&columns[0][name]=id&columns[0][searchable]=true&columns[0][orderable]=true&search[value]=`;
  const { recordsTotal, data } = AMJA_FATWAS.parse(
    JSON.parse(
      await get(`https://www.amjaonline.org/fatwa/${lang}?${query}`, {
        "x-requested-with": "XMLHttpRequest",
      }),
    ),
  );
  const urls = data.map(
    ({ data: { id, slug } }) =>
      `https://www.amjaonline.org/fatwa/${lang}/${id}/${slug}`,
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

const darulIftaaCategory = async (
  category: string,
  offset = 0,
): Promise<string[]> => {
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
  return [
    ...urls,
    ...(await darulIftaaCategory(category, offset + DARULIFTAA_PAGE)),
  ];
};

const darulIftaaFatwas = async () => {
  const sitemap = await get("https://daruliftaa.us/sitemap.xml");
  const categories = [
    ...sitemap.matchAll(/\/fatwas\/category\/([^/]+)\//gu),
  ].map(([, slug = ""]) => slug);
  return (
    await Promise.all(categories.map((slug) => darulIftaaCategory(slug)))
  ).flat();
};

const FATWAISLAM_FATWA = "https://fatwaislam.com/fis/index.cfm?scn=fd&ID=";

const fatwaIslamFatwas = async () => {
  const latest = await get(
    "https://fatwaislam.com/fis/index.cfm?scn=firstpage_latest",
  );
  const newest = Math.max(
    ...[...latest.matchAll(/scn=fd&(?:amp;)?ID=(\d+)/gu)].map(([, id]) =>
      Number(id),
    ),
  );
  return Array.from(
    { length: newest },
    (_, index) => `${FATWAISLAM_FATWA}${index + 1}`,
  );
};

const SITES: Site[] = [
  {
    source: {
      name: "islamqa.info",
      url: "https://islamqa.info",
      version: VERSION,
      license:
        "Not reviewed. islamqa.info/en/terms permits personal use; confirm reuse terms before launch",
      credit: "Islam Question & Answer (islamqa.info)",
    },
    sitemaps: ["https://islamqa.info/sitemaps/sitemap-index.xml"],
    page: ISLAMQA_ANSWER,
    parallel: 32,
    parse: (markdown, html, url) => {
      const [, lang, number] = ISLAMQA_ANSWER.exec(url) ?? [];
      const title = titleOf(markdown);
      const answerLabel = /<h2[^>]*>([^<]+)<hr/u.exec(html)?.[1];
      const summaryLabel =
        /<h2 class="[^"]*tw-text-secondary[^"]*">([^<]+)<\/h2>/u.exec(
          html,
        )?.[1];
      const sourceLabel =
        /<h2>([^<]+?)(?:<!-- -->)?:\s*<\/h2><p data-sut="fatwa-source"/u.exec(
          html,
        )?.[1];
      const answer = between(
        markdown,
        headingLine(answerLabel),
        headingLine(sourceLabel, ":"),
      );
      if (!title || !answer || !number) return undefined;
      return {
        id:
          lang === "en"
            ? `islamqa.info:${number}`
            : `islamqa.info:${lang}:${number}`,
        school: "hanbali",
        answeredBy: "IslamQA",
        title,
        question: between(
          markdown,
          new RegExp(`^## .+ ${number}\\s*$`, "mu"),
          /^## /mu,
        ),
        summary: between(
          markdown,
          headingLine(summaryLabel),
          /^(Similar Topics|## )/mu,
        ),
        answer,
        publishedAt: publishedOf(html),
      };
    },
  },
  {
    source: {
      name: "islamweb.net",
      url: "https://www.islamweb.net/en/fatawa/",
      version: VERSION,
      license: "Not reviewed. Confirm reuse terms before launch",
      credit: "Islamweb Fatwa Center (Qatar Ministry of Awqaf)",
    },
    sitemaps: [],
    listings: {
      start: ["https://www.islamweb.net/en/fatawa/"],
      follow:
        /^https:\/\/www\.islamweb\.net\/en\/fatawa\/\d+\/[^?]*(\?pageno=\d+&tab=1)?$/u,
    },
    page: /^https:\/\/www\.islamweb\.net\/(ar|en)\/fatwa\/\d+\//u,
    parallel: 8,
    parse: (markdown, html, url) => {
      const [, lang, number] = /\/(ar|en)\/fatwa\/(\d+)\//u.exec(url) ?? [];
      const title = /<h2[^>]*>([\s\S]*?)<\/h2>/u
        .exec(html)?.[1]
        ?.replaceAll(/<[^>]+>/gu, "")
        .trim();
      const [asked, answered] = [...markdown.matchAll(/^### .+$/gmu)];
      const [question, answer = ""] =
        asked && answered
          ? [
              markdown.slice(asked.index + asked[0].length, answered.index),
              markdown.slice(answered.index + answered[0].length),
            ].map((part) => part.trim())
          : [...html.matchAll(/<div itemprop="text">([\s\S]*?)<\/div>/gu)].map(
              ([, part = ""]) => plainText(part),
            );
      if (!title || answer.length < 100) return undefined;
      return {
        id: `islamweb.net:${lang}:${number}`,
        answeredBy: "Islamweb Fatwa Center",
        title: decode(title),
        question: question || undefined,
        answer,
      };
    },
  },
  {
    source: {
      name: "islamqa.org",
      url: "https://islamqa.org",
      version: VERSION,
      license:
        "Not reviewed. Answers are collected from each darul iftaa's own site; confirm reuse terms before launch",
      credit: "IslamQA.org and the darul iftaas it collects from",
    },
    sitemaps: ["https://islamqa.org/sitemap.xml"],
    page: /^https:\/\/islamqa\.org\/(hanafi|shafii|maliki|hanbali)\/[^/]+\/\d+\//u,
    skip: new RegExp(
      `^https://islamqa\\.org/[^/]+/(${Object.keys(FATWA_MIRRORS).join("|")})/`,
      "u",
    ),
    parallel: 32,
    parse: (markdown, html, url) => {
      const title = titleOf(markdown);
      const scholar = /Answered by\s*\n+\s*(.+)/u.exec(markdown)?.[1]?.trim();
      const from =
        /<meta[^>]+property="article:section"[^>]+content="([^"]+)"/u.exec(
          html,
        )?.[1];
      const body = between(
        markdown,
        /^From\b.*$/mu,
        /^(\**Original Source Link\**|This answer was collected|Tags:)/mu,
      )
        ?.replace(/^Answered by\s*\n+\s*.+\n*/u, "")
        .trim();
      if (!title || !body) return undefined;
      const split = /^#+\s*\**Answer:?\**\s*$/mu.exec(body);
      return {
        id: `islamqa.org:${/^https:\/\/islamqa\.org\/[^/]+\/[^/]+\/(\d+)\//u.exec(url)?.[1]}`,
        school: schoolOf(url),
        answeredBy: [scholar, from].filter(Boolean).join(", ") || undefined,
        title,
        question: split
          ? body
              .slice(0, split.index)
              .replace(/^#+\s*\**Question:?\**\s*$/mu, "")
              .trim() || undefined
          : undefined,
        answer: split ? body.slice(split.index + split[0].length).trim() : body,
        publishedAt: publishedOf(html),
      };
    },
  },
  articleSite({
    name: "seekersguidance.org",
    url: "https://seekersguidance.org/answers/",
    credit: "SeekersGuidance",
    sitemaps: ["https://seekersguidance.org/sitemap_index.xml"],
    follow: /^post-sitemap\d*\.xml$/u,
    page: /^https:\/\/seekersguidance\.org\/answers\//u,
    parallel: 1,
    delayMs: 10_000,
    answeredBy: (markdown) =>
      (/^Answered by (.+)$/mu.exec(markdown) ??
        /^## (.+?) (?:is asked|addresses|answers|explains|discusses|clarifies|advises|responds)\b/mu.exec(
          markdown,
        ) ??
        /^\[[A-Z][a-z]+ \d{1,2}, \d{4}\] \[([^\]]+)\]/mu.exec(
          markdown,
        ))?.[1]?.trim(),
  }),
  articleSite({
    name: "iifa-aifi.org",
    url: "https://iifa-aifi.org/ar",
    credit: "International Islamic Fiqh Academy (OIC)",
    sitemaps: ["https://iifa-aifi.org/ar/wp-sitemap.xml"],
    page: /^https:\/\/iifa-aifi\.org\/ar\/\d+\.html$/u,
    answeredBy: by("International Islamic Fiqh Academy"),
  }),
  articleSite({
    name: "albalagh.net",
    url: "https://albalagh.net",
    credit: "Albalagh (Mufti Taqi Usmani, Khalid Baig)",
    sitemaps: ["https://albalagh.net/sitemap_index.xml"],
    page: /^https:\/\/(www\.)?albalagh\.net\/[a-z_-]+\/[^/]+/u,
    school: "hanafi",
  }),
  articleSite({
    name: "mathabah.org",
    url: "https://mathabah.org",
    credit: "Mathabah (Mufti Abdur-Rahman ibn Yusuf Mangera)",
    sitemaps: ["https://mathabah.org/sitemap_index.xml"],
    page: /^https:\/\/(www\.)?mathabah\.org\/[^/]+\/?$/u,
    school: "hanafi",
  }),
  articleSite({
    name: "akramnadwi.com",
    url: "https://akramnadwi.com",
    credit: "Shaykh Mohammad Akram Nadwi",
    sitemaps: ["https://akramnadwi.com/wp-sitemap.xml"],
    follow: /posts-(post|qa)/u,
    page: /^https:\/\/(www\.)?akramnadwi\.com\/.+/u,
    answeredBy: by("Shaykh Mohammad Akram Nadwi"),
  }),
  articleSite({
    name: "drhatemalhaj.com",
    url: "https://www.drhatemalhaj.com",
    credit: "Dr. Hatem al-Haj",
    sitemaps: ["https://www.drhatemalhaj.com/wp-sitemap.xml"],
    follow: /posts-post/u,
    page: /^https:\/\/www\.drhatemalhaj\.com\/.+/u,
    school: "hanbali",
    answeredBy: by("Dr. Hatem al-Haj"),
  }),
  articleSite({
    name: "basiraeducation.org",
    url: "https://www.basiraeducation.org/blog",
    credit: "Basira Education (Shaykh Hamza Karamali)",
    sitemaps: ["https://www.basiraeducation.org/sitemap.xml"],
    page: /^https:\/\/www\.basiraeducation\.org\/blog\/.+/u,
    school: "shafii",
  }),
  articleSite({
    name: "amjaonline.org",
    url: "https://www.amjaonline.org",
    credit: "Assembly of Muslim Jurists of America",
    sitemaps: ["https://www.amjaonline.org/post-sitemap.xml"],
    discover: async () => [
      ...(await amjaFatwas("en")),
      ...(await amjaFatwas("ar")),
    ],
    page: /^https:\/\/www\.amjaonline\.org\/.+/u,
    answeredBy: by("Assembly of Muslim Jurists of America"),
  }),
  articleSite({
    name: "diftalon.com",
    url: "https://www.diftalon.com",
    credit: "Darul Ifta London",
    sitemaps: ["https://www.diftalon.com/post-sitemap.xml"],
    page: /^https:\/\/www\.diftalon\.com\/[^/]+\/?$/u,
    school: "hanafi",
    answeredBy: by("Darul Ifta London"),
  }),
  articleSite({
    name: "fiqhcouncil.org",
    url: "https://fiqhcouncil.org",
    credit: "Fiqh Council of North America",
    sitemaps: ["https://fiqhcouncil.org/post-sitemap.xml"],
    page: /^https:\/\/fiqhcouncil\.org\/.+/u,
    answeredBy: by("Fiqh Council of North America"),
  }),
  articleSite({
    name: "yaqeeninstitute.org",
    url: "https://yaqeeninstitute.org/read",
    credit: "Yaqeen Institute for Islamic Research",
    sitemaps: [
      "https://yaqeeninstitute.org/post-sitemap1.xml",
      "https://yaqeeninstitute.org/post-sitemap2.xml",
    ],
    page: /^https:\/\/yaqeeninstitute\.org\/read\/.+/u,
    parallel: 4,
  }),
  articleSite({
    name: "islamonline.net",
    url: "https://islamonline.net",
    credit: "IslamOnline",
    sitemaps: ["https://islamonline.net/sitemap_index.xml"],
    follow: /^post-sitemap\d*\.xml$/u,
    page: /^https:\/\/islamonline\.net\/(?!fr\/).+/u,
    parallel: 4,
  }),
  articleSite({
    name: "qalaminstitute.org",
    url: "https://www.qalaminstitute.org",
    credit: "Qalam Institute",
    sitemaps: ["https://qalaminstitute.org/sitemap_index.xml"],
    follow: /^post-sitemap\d*\.xml$/u,
    page: /^https:\/\/(www\.)?qalaminstitute\.org\/\d{4}\/.+/u,
  }),
  articleSite({
    name: "almadina.org",
    url: "https://www.almadina.org/studio/articles",
    credit: "Al-Madina Institute",
    sitemaps: ["https://www.almadina.org/sitemap.xml"],
    page: /^https:\/\/www\.almadina\.org\/studio\/articles\/.+/u,
  }),
  articleSite({
    name: "muslimheritage.com",
    url: "https://muslimheritage.com",
    credit: "Muslim Heritage (FSTC)",
    sitemaps: ["https://muslimheritage.com/sitemap_index.xml"],
    follow: /^post-sitemap\d*\.xml$/u,
    page: /^https:\/\/muslimheritage\.com\/[^/]+\/?$/u,
  }),
  articleSite({
    name: "thehumblei.com",
    url: "https://thehumblei.com",
    credit: "The Humble I (Abu Aaliyah Surkheel Sharif)",
    sitemaps: ["https://thehumblei.com/sitemap.xml"],
    page: /^https:\/\/thehumblei\.com\/\d{4}\/\d{2}\/\d{2}\/.+/u,
    answeredBy: by("Abu Aaliyah Surkheel Sharif"),
  }),
  articleSite({
    name: "renovatio.zaytuna.edu",
    url: "https://renovatio.zaytuna.edu",
    credit: "Renovatio, Zaytuna College",
    sitemaps: ["https://renovatio.zaytuna.edu/sitemap.xml"],
    page: /^https:\/\/renovatio\.zaytuna\.edu\/article\/.+/u,
  }),
  articleSite({
    name: "sapienceinstitute.org",
    url: "https://www.sapienceinstitute.org",
    credit: "Sapience Institute",
    sitemaps: ["https://www.sapienceinstitute.org/wp-sitemap.xml"],
    follow: /posts-post/u,
    page: /^https:\/\/www\.sapienceinstitute\.org\/[^/]+\/?$/u,
  }),
  articleSite({
    name: "sandala.org",
    url: "https://sandala.org/blogs",
    credit: "Sandala (Shaykh Hamza Yusuf)",
    sitemaps: ["https://sandala.org/sitemap.xml"],
    follow: /^sitemap_(blogs|articles)/u,
    page: /^https:\/\/sandala\.org\/blogs\/[^/]+\/.+/u,
  }),
  articleSite({
    name: "islamicorigins.com",
    url: "https://islamicorigins.com",
    credit: "Islamic Origins (Dr. Joshua Little)",
    sitemaps: ["https://islamicorigins.com/post-sitemap.xml"],
    page: /^https:\/\/islamicorigins\.com\/.+/u,
  }),
  articleSite({
    name: "hadithoftheday.com",
    url: "https://hadithoftheday.com",
    credit: "Hadith of the Day",
    sitemaps: ["https://hadithoftheday.com/wp-sitemap.xml"],
    follow: /posts-post/u,
    page: /^https:\/\/hadithoftheday\.com\/[^/]+\/?$/u,
  }),
  articleSite({
    name: "islamicfinanceguru.com",
    url: "https://www.islamicfinanceguru.com",
    credit: "Islamic Finance Guru",
    sitemaps: ["https://www.islamicfinanceguru.com/sitemap.xml"],
    page: /^https:\/\/www\.islamicfinanceguru\.com\/(articles|dictionary|guides-and-faqs|goal-based-guides)\/.+/u,
  }),
  articleSite({
    name: "blog.zoya.finance",
    url: "https://blog.zoya.finance",
    credit: "Zoya",
    sitemaps: ["https://blog.zoya.finance/sitemap.xml"],
    page: /^https:\/\/blog\.zoya\.finance\/(?!(fr|de|ar|tr|id|es)\/).+/u,
  }),
  articleSite({
    name: "herislamicfinance.com",
    url: "https://herislamicfinance.com/blog",
    credit: "Her Islamic Finance",
    sitemaps: ["https://herislamicfinance.com/sitemap-index.xml"],
    page: /^https:\/\/herislamicfinance\.com\/blog\/.+/u,
  }),
  articleSite({
    name: "muslimmatters.org",
    url: "https://muslimmatters.org",
    credit: "MuslimMatters (community blog)",
    sitemaps: ["https://muslimmatters.org/sitemap_index.xml"],
    follow: /^post-sitemap\d*\.xml$/u,
    page: /^https:\/\/muslimmatters\.org\/\d{4}\/.+/u,
    parallel: 4,
  }),
  articleSite({
    name: "virtualmosque.com",
    url: "https://www.virtualmosque.com",
    credit: "Virtual Mosque (community blog)",
    sitemaps: ["https://www.virtualmosque.com/wp-sitemap.xml"],
    follow: /posts-post/u,
    page: /^https:\/\/www\.virtualmosque\.com\/.+/u,
  }),
  articleSite({
    name: "productivemuslim.com",
    url: "https://productivemuslim.com",
    credit: "ProductiveMuslim (community blog)",
    sitemaps: ["https://productivemuslim.com/sitemap-index.xml"],
    page: /^https:\/\/productivemuslim\.com\/(?!blog\/|reading-list\/).+/u,
  }),
  articleSite({
    name: "aboutislam.net",
    url: "https://aboutislam.net",
    credit: "AboutIslam",
    sitemaps: ["https://aboutislam.net/sitemap_index.xml"],
    follow: /^(post|counseling|live_session)-sitemap\d*\.xml$/u,
    page: /^https:\/\/aboutislam\.net\/(counseling|live-session|reading-islam|family-life|shariah|spirituality|muslim-issues|science|blog)\/.+/u,
    parallel: 4,
  }),
  articleSite({
    name: "dar-alifta.org",
    url: "https://www.dar-alifta.org",
    credit: "Dar al-Ifta al-Misriyyah",
    sitemaps: [
      "https://www.dar-alifta.org/en/sitemap.xml",
      "https://www.dar-alifta.org/ar/sitemap.xml",
    ],
    page: /^https:\/\/www\.dar-alifta\.org\/(en|ar)\/fatwa\/details\/\d+/iu,
    parallel: 4,
    answeredBy: by("Dar al-Ifta al-Misriyyah"),
  }),
  articleSite({
    name: "en.tohed.com",
    url: "https://en.tohed.com",
    credit: "Tohed",
    sitemaps: ["https://en.tohed.com/sitemap.php"],
    page: /^https:\/\/en\.tohed\.com\/threads\/.+/u,
    answeredBy: by("Tohed"),
  }),
  articleSite({
    name: "fiqh.islamonline.net",
    url: "https://fiqh.islamonline.net",
    credit: "IslamOnline Fiqh",
    sitemaps: ["https://fiqh.islamonline.net/sitemap_index.xml"],
    follow: /^post-sitemap\d*\.xml$/u,
    page: /^https:\/\/fiqh\.islamonline\.net\/.+/u,
    parallel: 4,
    delayMs: 500,
    answeredBy: by("IslamOnline"),
  }),
  articleSite({
    name: "al-fatawa.com",
    url: "https://al-fatawa.com/en",
    credit:
      "Al-Fatawa (Ibn Baz, Ibn Uthaymeen, al-Albani, al-Fawzan, the Permanent Committee). English is machine translation",
    sitemaps: ["https://al-fatawa.com/sitemap.xml"],
    follow: /^sitemap-en-(?!pages)/u,
    page: /^https:\/\/al-fatawa\.com\/en\/fatwa\/\d+\/.+/u,
    parallel: 4,
  }),
  articleSite({
    name: "daruliftaa.us",
    url: "https://daruliftaa.us",
    credit: "Darul Iftaa Chicago",
    sitemaps: [],
    discover: darulIftaaFatwas,
    page: /^https:\/\/daruliftaa\.us\/fatwa\/\d+\/$/u,
    answerMark: /^#+ \**الجواب.*$/mu,
    school: "hanafi",
    answeredBy: by("Darul Iftaa Chicago"),
  }),
  {
    ...articleSite({
      name: "fatwaislam.com",
      url: "https://fatwaislam.com/fis/",
      credit: "FatwaIslam",
      sitemaps: [],
      discover: fatwaIslamFatwas,
      page: /^https:\/\/fatwaislam\.com\/fis\/index\.cfm\?scn=fd&ID=\d+$/u,
      skip: /$^/u,
      parallel: 1,
      delayMs: 30_000,
    }),
    parse: (_markdown, html, url) => {
      const grab = (pattern: RegExp) => pattern.exec(html)?.[1] ?? "";
      const title = plainText(
        grab(/<font style="font-size:13px;">\s*<b>([\s\S]*?)<\/b>/u),
      );
      const question = plainText(grab(/<u>Question:<\/u>([\s\S]*?)<\/td>/u));
      const answer = plainText(grab(/<u>Answer:<\/u>([\s\S]*?)<\/td>/u));
      const credit = grab(
        /<u>Answer:<\/u>[\s\S]*?<\/td>([\s\S]*?)<b>Other subjects of interest/u,
      );
      return title && question && answer
        ? {
            id: `fatwaislam.com:${new URL(url).searchParams.get("ID")}`,
            answeredBy:
              plainText(/<b>([\s\S]*?)<\/b>/u.exec(credit)?.[1] ?? "") ||
              undefined,
            title,
            question,
            answer: [answer, plainText(credit)].filter(Boolean).join("\n\n"),
          }
        : undefined;
    },
  },
  articleSite({
    name: "muftiwp.gov.my",
    url: "https://muftiwp.gov.my/en/artikel",
    credit: "Federal Territory Mufti Office, Malaysia",
    sitemaps: [],
    listings: {
      start: [
        "https://muftiwp.gov.my/en/artikel/irsyad-al-hadith",
        "https://muftiwp.gov.my/en/artikel/irsyad-usul-fiqh",
        "https://muftiwp.gov.my/en/artikel/bayan-li-al-haj",
      ],
      follow:
        /^https:\/\/muftiwp\.gov\.my\/en\/artikel\/(?:irsyad-al-hadith|irsyad-usul-fiqh|bayan-li-al-haj)\?start=\d+$/u,
    },
    page: /^https:\/\/muftiwp\.gov\.my\/en\/artikel\/(?:irsyad-al-hadith|irsyad-usul-fiqh|bayan-li-al-haj)\/\d+-[^/?#]*-series-[^/?#]*$/u,
    headline: /<h2 itemprop="headline"[^>]*>([^<]+)/u,
    parallel: 1,
    delayMs: 1_000,
    school: "shafii",
    answeredBy: by("Federal Territory Mufti Office"),
  }),
  articleSite({
    name: "britishfatwacouncil.org",
    url: "https://www.britishfatwacouncil.org",
    credit: "British Fatwa Council",
    sitemaps: ["https://www.britishfatwacouncil.org/post-sitemap.xml"],
    page: /^https:\/\/www\.britishfatwacouncil\.org\/.+/u,
    answeredBy: by("British Fatwa Council"),
  }),
];

const piecesOf = (paragraph: string): string[] => {
  if (paragraph.length <= CHUNK_CHARS) return [paragraph];
  const lineEnd = paragraph.lastIndexOf("\n", CHUNK_CHARS);
  const sentenceEnd = paragraph.lastIndexOf(". ", CHUNK_CHARS) + 1;
  const natural = Math.max(lineEnd, sentenceEnd);
  const cut = natural > CHUNK_CHARS / 2 ? natural : CHUNK_CHARS;
  const rest = paragraph.slice(cut).trimStart();
  return [paragraph.slice(0, cut).trimEnd(), ...(rest ? piecesOf(rest) : [])];
};

const chunksOf = (text: string) => {
  const parts: string[] = [];
  for (const paragraph of text.split(/\n\n/u).flatMap(piecesOf)) {
    const last = parts.at(-1);
    if (last !== undefined && last.length + paragraph.length < CHUNK_CHARS) {
      parts[parts.length - 1] = `${last}\n\n${paragraph}`;
    } else parts.push(paragraph);
  }
  return parts;
};

const passageRow = (
  fatwa: Fatwa,
  source: string,
  url: string,
  answer: string,
  index: number,
) => ({
  ...fatwa,
  id: index === 0 ? fatwa.id : `${fatwa.id}#${index + 1}`,
  question: index === 0 ? fatwa.question : undefined,
  summary: index === 0 ? fatwa.summary : undefined,
  answer,
  source,
  url,
});

const rowsOf = async (site: Site, url: string) => {
  const html = await pageHtml(url);
  const fatwa = site.parse(
    clean(htmlToMarkdown(html, url).markdown),
    html,
    url,
  );
  return fatwa
    ? chunksOf(fatwa.answer).map((answer, index) =>
        passageRow(fatwa, site.source.name, url, answer, index),
      )
    : undefined;
};

type Row = NonNullable<Awaited<ReturnType<typeof rowsOf>>>[number];

const sizeOf = (text: string | null | undefined) =>
  text
    ? `${text.length} chars (~${Math.round(text.length / 4)} tokens)`
    : "none";

const preview = (fatwa: Row) => {
  return [
    `${fatwa.id} | ${fatwa.school ?? "no school"} | ${fatwa.answeredBy} | ${fatwa.publishedAt?.toISOString().slice(0, 10) ?? "no date"}`,
    `  title: ${fatwa.title}`,
    `  question: ${sizeOf(fatwa.question)} | summary: ${sizeOf(fatwa.summary)} | answer: ${sizeOf(fatwa.answer)}`,
    `  answer starts: ${fatwa.answer.slice(0, 220).replaceAll("\n", " ")}`,
    `  answer ends: …${fatwa.answer.slice(-140).replaceAll("\n", " ")}`,
  ].join("\n");
};

const crawl = async (site: Site) => {
  await mkdir(`${RAW_DIR}/${new URL(site.source.url).hostname}`, {
    recursive: true,
  });
  const samples = DRY ? SAMPLES.filter((url) => site.page.test(url)) : [];
  const found =
    samples.length > 0
      ? samples
      : [
          ...(
            await Promise.all(
              site.sitemaps.map((url) => sitemapUrls(url, site)),
            )
          ).flat(),
          ...(await listedUrls(site)),
          ...((await site.discover?.()) ?? []),
        ].filter((url) => site.page.test(url) && !site.skip?.test(url));
  const urls = [...new Set(found)];
  console.log(`${site.source.name}: ${urls.length} pages found`);
  if (DRY) {
    const picks =
      samples.length > 0
        ? urls
        : urls.filter(
            (_, index) =>
              index %
                Math.ceil(
                  urls.length / (Number.isFinite(LIMIT) ? LIMIT : 3),
                ) ===
              0,
          );
    const parsed: Row[][] = [];
    const visit = async ([url, ...rest]: string[]): Promise<void> => {
      if (url === undefined) return;
      const fetched = !(await rawFile(url).exists());
      const rows = await rowsOf(site, url).catch((error: Error) => error);
      if (rows instanceof Error) console.log(`  FAILED ${rows.message}`);
      else if (rows) parsed.push(rows);
      else console.log(`  NOT PARSED ${url}`);
      if (fetched && site.delayMs) await Bun.sleep(site.delayMs);
      return visit(rest);
    };
    await visit(picks);
    for (const rows of parsed.slice(0, samples.length > 0 ? undefined : 3)) {
      const [first] = rows;
      if (first) {
        console.log(
          `${preview(first)}${rows.length > 1 ? `\n  (${rows.length} passages)` : ""}`,
        );
      }
    }
    console.log(
      `${site.source.name}: ${parsed.length} of ${picks.length} sampled pages parsed`,
    );
    return;
  }
  const stored = new Set(
    (
      await db
        .select({ url: fatwas.url })
        .from(fatwas)
        .where(eq(fatwas.source, site.source.name))
    ).map((row) => row.url),
  );
  const queue = urls.filter((url) => !stored.has(url));
  let saved = 0;
  let skipped = 0;
  let failed = 0;
  let batch: Row[] = [];
  const flush = async () => {
    const rows = batch;
    batch = [];
    if (rows.length > 0)
      await db.insert(fatwas).values(rows).onConflictDoNothing();
    saved += rows.length;
    console.log(
      `${site.source.name}: ${saved} saved, ${skipped} not parsed, ${failed} failed, ${queue.length} left`,
    );
  };
  const work = async (): Promise<void> => {
    const url = queue.shift();
    if (url === undefined || saved + batch.length >= LIMIT) return;
    const rows = await rowsOf(site, url).catch((error: Error) => {
      failed++;
      console.warn(error.message);
      return undefined;
    });
    if (rows) batch.push(...rows);
    else {
      skipped++;
      console.warn(`not parsed: ${url}`);
    }
    if (batch.length >= BATCH_SIZE) await flush();
    if (site.delayMs) await Bun.sleep(site.delayMs);
    return work();
  };
  await Promise.all(Array.from({ length: site.parallel }, work));
  await flush();
};

const chosen = SITES.filter(
  (site) =>
    (ONLY === undefined || ONLY.includes(site.source.name)) &&
    (SAMPLES.length === 0 || SAMPLES.some((url) => site.page.test(url))),
);
if (!DRY && chosen.length > 0) {
  await db
    .insert(sources)
    .values(chosen.map((site) => site.source))
    .onConflictDoUpdate({ target: sources.name, set: { version: VERSION } });
}
await inPool(chosen, SITES_AT_ONCE, (site) =>
  crawl(site).catch((error: Error) =>
    console.warn(`${site.source.name} stopped: ${error.message}`),
  ),
);
if (!DRY) await db.$client.end();
