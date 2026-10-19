import { mkdir, rm } from "node:fs/promises";
import { db } from "@sirathic/db";
import { redditThreads } from "@sirathic/db/schema";
import { spawn } from "bun";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { DATA_DIR } from "./catalog";

const SUBREDDITS = [
  "islam",
  "exmuslim",
  "MuslimMarriage",
  "MuslimLounge",
  "shia",
  "Muslim",
  "progressive_islam",
  "Hijabis",
  "MuslimNoFap",
  "MuslimCorner",
  "indianmuslims",
  "converts",
  "Quraniyoon",
  "IslamicFinance",
  "AcademicQuran",
  "MuslimNikah",
] as const;

const DUMPS = `${DATA_DIR}/reddit/torrent/reddit/subreddits24`;
const RECENT = `${DATA_DIR}/reddit/arctic`;
const BUILD = `${DATA_DIR}/reddit/build`;
const BUCKETS = 64;
const BATCH_SIZE = 200;
const LOAD = process.argv.includes("--load");
const ONLY = process.argv
  .find((arg) => arg.startsWith("--subs="))
  ?.slice(7)
  .split(",");

const post = z.object({
  id: z.string(),
  title: z.string().catch(""),
  selftext: z.string().nullish(),
  score: z.number().catch(0),
  removed_by_category: z.string().nullish(),
  stickied: z.boolean().nullish(),
  url: z.string().nullish(),
  is_video: z.boolean().nullish(),
  is_gallery: z.boolean().nullish(),
  post_hint: z.string().nullish(),
  created_utc: z.coerce.number(),
});

const MEDIA_LINK =
  /^https?:\/\/(?:[a-z0-9-]+\.)*(?:redd\.it|imgur\.com|gfycat\.com|youtube\.com|youtu\.be|tiktok\.com|instagram\.com|streamable\.com)\/|^https?:\/\/(?:www\.)?reddit\.com\/gallery\//iu;

const isPhotoOrVideo = ({
  url,
  is_video,
  is_gallery,
  post_hint,
}: z.infer<typeof post>) =>
  Boolean(is_video || is_gallery) ||
  post_hint === "image" ||
  post_hint?.includes("video") ||
  MEDIA_LINK.test(url ?? "");

const comment = z.object({
  id: z.string(),
  link_id: z.coerce.string(),
  parent_id: z.coerce.string(),
  body: z.string().nullish(),
  score: z.number().catch(0),
  author: z.string().nullish(),
  distinguished: z.string().nullish(),
});

const GONE = new Set(["", "[removed]", "[deleted]"]);

const textOf = (value: string | null | undefined) =>
  value?.replaceAll("\u0000", "").trim() ?? "";

type Thread = typeof redditThreads.$inferInsert;

const lines = async function* (file: string) {
  if (!(await Bun.file(file).exists())) return;
  const stream = file.endsWith(".zst")
    ? spawn(["zstd", "-dc", "--long=31", file], { stderr: "ignore" }).stdout
    : Bun.file(file).stream();
  const decoder = new TextDecoder();
  let rest = "";
  for await (const chunk of stream) {
    const parts = (rest + decoder.decode(chunk, { stream: true })).split("\n");
    rest = parts.pop() ?? "";
    yield* parts.filter(Boolean);
  }
  if (rest) yield rest;
};

const linesOf = async function* (...files: string[]) {
  for (const file of files) yield* lines(file);
};

const bucketOf = (id: string) => Number.parseInt(id.slice(-6), 36) % BUCKETS;

const splitIntoBuckets = async (subreddit: string) => {
  await rm(BUILD, { recursive: true, force: true });
  await mkdir(BUILD, { recursive: true });
  const writers = Array.from({ length: BUCKETS }, (_, index) => ({
    posts: Bun.file(`${BUILD}/${index}.posts`).writer(),
    comments: Bun.file(`${BUILD}/${index}.comments`).writer(),
  }));
  for await (const line of linesOf(
    `${DUMPS}/${subreddit}_submissions.zst`,
    `${RECENT}/${subreddit}_posts.ndjson`,
  )) {
    const found = post.safeParse(JSON.parse(line));
    if (!found.success) continue;
    const { id, selftext, removed_by_category, stickied } = found.data;
    const text = selftext?.trim() ?? "";
    if (removed_by_category || text === "[removed]" || text === "[deleted]")
      continue;
    if (stickied || (text === "" && isPhotoOrVideo(found.data))) continue;
    writers[bucketOf(id)]?.posts.write(`${line}\n`);
  }
  for await (const line of linesOf(
    `${DUMPS}/${subreddit}_comments.zst`,
    `${RECENT}/${subreddit}_comments.ndjson`,
  )) {
    const found = comment.safeParse(JSON.parse(line));
    if (!found.success) continue;
    const { link_id, body, author, distinguished } = found.data;
    if (GONE.has(body?.trim() ?? "")) continue;
    if (author === "AutoModerator" || distinguished === "moderator") continue;
    writers[bucketOf(link_id.replace(/^t3_/u, ""))]?.comments.write(
      `${line}\n`,
    );
  }
  await Promise.all(
    writers.flatMap(({ posts, comments }) => [posts.end(), comments.end()]),
  );
};

const threadsIn = async function* (subreddit: string, bucket: number) {
  const threads = new Map<string, Thread>();
  for await (const line of lines(`${BUILD}/${bucket}.posts`)) {
    const { id, title, selftext, score, created_utc } = post.parse(
      JSON.parse(line),
    );
    threads.set(id, {
      id,
      subreddit,
      url: `https://www.reddit.com/r/${subreddit}/comments/${id}/`,
      title: textOf(title),
      question: textOf(selftext) || null,
      score,
      postedAt: new Date(created_utc * 1000),
      comments: [],
    });
  }
  const seen = new Set<string>();
  for await (const line of lines(`${BUILD}/${bucket}.comments`)) {
    const { id, link_id, parent_id, body, score } = comment.parse(
      JSON.parse(line),
    );
    const thread = threads.get(link_id.replace(/^t3_/u, ""));
    if (!thread || seen.has(id)) continue;
    seen.add(id);
    thread.comments.push({
      id,
      parent: parent_id.replace(/^t[13]_/u, ""),
      score,
      body: textOf(body),
    });
  }
  for (const thread of threads.values()) {
    thread.comments.sort((a, b) => b.score - a.score);
    yield thread;
  }
};

const threadsOf = async function* (subreddit: string) {
  await splitIntoBuckets(subreddit);
  for (let bucket = 0; bucket < BUCKETS; bucket++) {
    yield* threadsIn(subreddit, bucket);
  }
  await rm(BUILD, { recursive: true, force: true });
};

const threadsOfAll = async function* (subreddits: readonly string[]) {
  for (const subreddit of subreddits) yield* threadsOf(subreddit);
};

const batchesOf = async function* <T>(items: AsyncIterable<T>, size: number) {
  let batch: T[] = [];
  for await (const item of items) {
    batch.push(item);
    if (batch.length === size) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length > 0) yield batch;
};

const save = (threads: Thread[]) =>
  db
    .insert(redditThreads)
    .values(threads)
    .onConflictDoUpdate({
      target: redditThreads.id,
      set: {
        title: sql`excluded.title`,
        question: sql`excluded.question`,
        score: sql`excluded.score`,
        comments: sql`excluded.comments`,
      },
    });

if (import.meta.main) {
  const chosen = SUBREDDITS.filter(
    (name) => ONLY === undefined || ONLY.includes(name),
  );
  const outPath = `${DATA_DIR}/reddit/threads.ndjson`;
  if (!LOAD) await rm(outPath, { force: true });
  const out = LOAD ? undefined : Bun.file(outPath).writer();
  const counts = new Map<string, { threads: number; comments: number }>();
  for await (const batch of batchesOf(threadsOfAll(chosen), BATCH_SIZE)) {
    if (out)
      for (const thread of batch) out.write(`${JSON.stringify(thread)}\n`);
    else await save(batch);
    for (const thread of batch) {
      const count = counts.get(thread.subreddit) ?? { threads: 0, comments: 0 };
      count.threads++;
      count.comments += thread.comments.length;
      counts.set(thread.subreddit, count);
      if (LOAD && count.threads % 20_000 === 0)
        console.log(`r/${thread.subreddit}: ${count.threads} threads saved`);
    }
  }
  await out?.end();
  for (const [subreddit, { threads, comments }] of counts) {
    console.log(`r/${subreddit}: ${threads} threads, ${comments} comments`);
  }
  await db.$client.end();
}
