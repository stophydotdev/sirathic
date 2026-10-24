import { z } from "zod";
import { stophy } from "../stophy";

export const youtubeSearchInput = z.object({
  query: z.string().trim().min(2).max(200),
  limit: z.number().int().min(1).max(15).default(8),
});

export const youtubeSearch = async (input: z.input<typeof youtubeSearchInput>) => {
  const { query, limit } = youtubeSearchInput.parse(input);
  const { data } = await stophy.youtube.search({ query, type: "videos" });
  const videos = data.results.flatMap((video) =>
    video.type === "video" && video.videoId && video.videoUrl
      ? [
          {
            videoId: video.videoId,
            url: video.videoUrl,
            title: video.title ?? "",
            channel: video.channelName ?? null,
            description: video.channelName ?? "",
            durationSeconds: video.durationSeconds ?? null,
            views: video.views ?? null,
            publishedAt: video.publishedAt ?? null,
          },
        ]
      : [],
  );
  return { query, videos: videos.slice(0, limit) };
};
