import { z } from "zod";
import { cacheFor } from "../cache";
import { stophy } from "../stophy";

const TIMEOUT_MS = 20_000;
const DAY_MS = 24 * 60 * 60_000;
const VIDEO_ID =
  /^https?:\/\/(?:[\w-]+\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})(?![\w-])/u;

export const youtubeVideoId = (url: string) => VIDEO_ID.exec(url)?.[1];

const video = z.object({
  title: z.string(),
  channel: z.string(),
  description: z.string(),
  thumbnail: z.string().optional(),
  seconds: z.number().optional(),
  published: z.string().optional(),
  views: z.number().optional(),
  chapters: z.array(z.object({ title: z.string(), startSeconds: z.number() })),
});

export type YoutubeVideo = z.infer<typeof video>;

const videoCache = cacheFor({
  namespace: "youtube-video:v1",
  schema: video,
  freshMs: DAY_MS,
  keepMs: 7 * DAY_MS,
});

const transcriptCache = cacheFor({
  namespace: "youtube-transcript:v1",
  schema: z.object({ text: z.string() }),
  freshMs: 7 * DAY_MS,
  keepMs: 30 * DAY_MS,
});

export const youtubeVideo = (videoId: string) =>
  videoCache(videoId, async () => {
    const { data } = await stophy.youtube.video(
      { videoId },
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    return {
      title: data.title ?? "",
      channel: data.channelName ?? "",
      description: data.description ?? "",
      thumbnail: data.thumbnailUrl,
      seconds: data.durationSeconds,
      published: data.publishedAt,
      views: data.views,
      chapters: data.chapters.flatMap(({ title, startSeconds }) =>
        title ? [{ title, startSeconds }] : [],
      ),
    };
  });

export const youtubeTranscript = (videoId: string) =>
  transcriptCache(videoId, async () => {
    const { data } = await stophy.youtube.transcript(
      { videoId },
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    return { text: data.text ?? "" };
  });
