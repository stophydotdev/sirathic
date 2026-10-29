import { clip } from "@sirathic/core/stophy";
import {
  type YoutubeVideo,
  youtubeTranscript,
  youtubeVideo,
  youtubeVideoId,
} from "@sirathic/core/tools/youtubeVideo";
import { z } from "zod";
import { type Source, videoLength } from "../shared/sources";
import type { Row } from "./stophyTools";

const SNIPPET_CHARS = 300;
const SITE_SUFFIX = / - YouTube$/u;

const videoRow = z.object({
  channelName: z.string(),
  thumbnailUrl: z.string().optional().catch(undefined),
  durationSeconds: z.number().optional().catch(undefined),
  publishedAt: z.string().optional().catch(undefined),
  views: z.number().optional().catch(undefined),
});

export const videoOfRow = (url: string, row: Row): Source["video"] => {
  const found = youtubeVideoId(url) ? videoRow.safeParse(row).data : undefined;
  return (
    found && {
      channel: found.channelName,
      thumbnail: found.thumbnailUrl,
      seconds: found.durationSeconds,
      published: found.publishedAt,
      views: found.views,
    }
  );
};

const sourceOf = (url: string, video: YoutubeVideo): Source => ({
  url,
  title: video.title,
  snippet: clip(video.description, SNIPPET_CHARS),
  video: {
    channel: video.channel,
    thumbnail: video.thumbnail,
    seconds: video.seconds,
    published: video.published,
    views: video.views,
  },
});

const detailsOf = async (url: string) => {
  const id = youtubeVideoId(url);
  const video = id ? await youtubeVideo(id).catch(() => undefined) : undefined;
  return video?.title ? video : undefined;
};

export const withVideos = (sources: Source[]) =>
  Promise.all(
    sources.map(async (source) => {
      if (source.video || !youtubeVideoId(source.url)) return source;
      const video = await detailsOf(source.url);
      return video
        ? sourceOf(source.url, video)
        : { ...source, title: source.title.replace(SITE_SUFFIX, "") };
    }),
  );

export const withVideoHits = <Hit extends { url: string; title: string; description: string }>(
  hits: Hit[],
) =>
  Promise.all(
    hits.map(async (hit) => {
      const video = await detailsOf(hit.url);
      return video
        ? { ...hit, title: video.title, description: `${video.channel}. ${video.description}` }
        : hit;
    }),
  );

export const readVideo = async (url: string) => {
  const id = youtubeVideoId(url);
  const video = await detailsOf(url);
  if (!id || !video) return undefined;
  const transcript = await youtubeTranscript(id).catch(() => ({ text: "" }));
  const markdown = [
    `# ${video.title}`,
    [
      `Channel: ${video.channel}`,
      video.published && `Published: ${video.published}`,
      video.seconds !== undefined && `Length: ${videoLength(video.seconds)}`,
      video.views !== undefined && `Views: ${video.views}`,
    ]
      .filter(Boolean)
      .join("\n"),
    video.description,
    video.chapters.length > 0 &&
      `## Chapters\n\n${video.chapters.map((chapter) => `${videoLength(chapter.startSeconds)} ${chapter.title}`).join("\n")}`,
    transcript.text && `## Transcript\n\n${transcript.text}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { markdown, source: sourceOf(url, video) };
};
