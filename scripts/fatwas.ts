import { mkdir } from "node:fs/promises";
import { htmlToMarkdown } from "@sirathic/core/web/htmlToMarkdown";
import { db } from "@sirathic/db";
import { fatwas, sources } from "@sirathic/db/schema";
import { eq } from "drizzle-orm";
import {
  clean,
  creditsSpent,
  type Fatwa,
  listedUrls,
  pageHtml,
  RAW_DIR,
  rawFile,
  type Site,
  sitemapUrls,
  VERSION,
} from "./fatwaPages";
import { SITES } from "./fatwaSites";

const DRY = process.argv.includes("--dry");
const SAMPLES = process.argv.filter((arg) => arg.startsWith("https://"));
const LIMIT = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.slice(8) ?? Infinity);
const ONLY = process.argv
  .find((arg) => arg.startsWith("--sites="))
  ?.slice(8)
  .split(",");
const CHUNK_CHARS = 6_000;
const BATCH_SIZE = 100;
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

const passageRow = (fatwa: Fatwa, source: string, url: string, answer: string, index: number) => ({
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
  const fatwa = site.parse(clean(htmlToMarkdown(html, url).markdown), html, url);
  return fatwa
    ? chunksOf(fatwa.answer).map((answer, index) =>
        passageRow(fatwa, site.source.name, url, answer, index),
      )
    : undefined;
};

type Row = NonNullable<Awaited<ReturnType<typeof rowsOf>>>[number];

const sizeOf = (text: string | null | undefined) =>
  text ? `${text.length} chars (~${Math.round(text.length / 4)} tokens)` : "none";

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
          ...(await Promise.all(site.sitemaps.map((url) => sitemapUrls(url, site)))).flat(),
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
              index % Math.ceil(urls.length / (Number.isFinite(LIMIT) ? LIMIT : 3)) === 0,
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
        console.log(`${preview(first)}${rows.length > 1 ? `\n  (${rows.length} passages)` : ""}`);
      }
    }
    console.log(`${site.source.name}: ${parsed.length} of ${picks.length} sampled pages parsed`);
    return;
  }
  const stored = new Set(
    (
      await db.select({ url: fatwas.url }).from(fatwas).where(eq(fatwas.source, site.source.name))
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
    if (rows.length > 0) await db.insert(fatwas).values(rows).onConflictDoNothing();
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
await Promise.all(
  chosen.map((site) =>
    crawl(site)
      .catch((error: Error) => console.warn(`${site.source.name} stopped: ${error.message}`))
      .finally(() =>
        console.log(
          `${site.source.name}: ${creditsSpent(new URL(site.source.url).hostname)} Stophy credits`,
        ),
      ),
  ),
);
if (!DRY) await db.$client.end();
