import z from "zod";
import { env } from "@sirathic/env/server";
import { getStophy } from "@sirathic/core/stophy";
import type { Chunk } from "@sirathic/core/types";
import type { ResearchAction } from "../../types";

const MAX_TRANSCRIPT_CHARS = 8000;
const TRANSCRIPTS_PER_CALL = 2;
const MAX_TRANSCRIPT_ATTEMPTS = 5;

const schema = z.object({
  queries: z
    .array(z.string())
    .describe("An array of search queries to find relevant YouTube videos."),
});

const actionDescription = `
Use this tool to search YouTube and read the transcripts of the most relevant videos. This is useful when the answer lives in spoken content: lectures, khutbahs, talks by specific speakers or scholars, recitations, tutorials, reviews, interviews, and conference talks.
Use it when the user asks about videos, lectures, or what a specific speaker says, or when spoken-word content would clearly strengthen the answer. Do not use it for questions that ordinary text sources answer well.

Your queries should name the topic and, when relevant, the speaker or channel, e.g. "Omar Suleiman lecture on grief", "Surah Kahf tafsir lecture", "Next.js 16 tutorial".
Use only as many queries as needed (1-2 suffice). One call is normally enough — the tool reads the transcripts of the top videos for you, so you receive what was actually said, not just video titles.
`;

const youtubeSearchAction: ResearchAction<typeof schema> = {
  name: "youtube_search",
  schema,
  getToolDescription: () =>
    "Search YouTube and read transcripts of the top matching videos. Use for lectures, khutbahs, talks by specific speakers, recitations, tutorials, and reviews — answers that live in spoken content. Up to 2 queries at a time.",
  getDescription: () => actionDescription,
  enabled: (config) =>
    Boolean(env.STOPHY_API_KEY) &&
    config.sources.includes("youtube") &&
    config.classification.classification.skipSearch === false,
  execute: async (input, additionalConfig) => {
    const stophy = getStophy();

    const queries = (
      Array.isArray(input.queries) ? input.queries : [input.queries]
    ).slice(0, 2);

    additionalConfig.emitSubStep({
      type: "searching",
      queries: queries.map((q) => `youtube: ${q}`),
    });

    const videos: {
      videoUrl: string;
      title: string;
      author: string | null;
      description: string | null;
    }[] = [];

    await Promise.all(
      queries.map(async (q) => {
        const res = await stophy.search(q, { type: "video" });

        res.data.items.forEach((item) => {
          if (item.type === "video") {
            videos.push({
              videoUrl: item.videoUrl,
              title: item.title,
              author: item.author,
              description: item.description,
            });
          }
        });
      }),
    );

    const seenUrls = new Set<string>();
    const uniqueVideos = videos.filter((v) => {
      if (seenUrls.has(v.videoUrl)) return false;
      seenUrls.add(v.videoUrl);
      return true;
    });

    const candidates = uniqueVideos.filter(
      (v) => !additionalConfig.scrapedUrls.has(v.videoUrl),
    );

    const results: Chunk[] = [];
    const readUrlsThisCall: string[] = [];
    let attempts = 0;

    for (const video of candidates) {
      if (readUrlsThisCall.length >= TRANSCRIPTS_PER_CALL) break;
      if (attempts >= MAX_TRANSCRIPT_ATTEMPTS) break;

      attempts++;
      additionalConfig.scrapedUrls.add(video.videoUrl);

      try {
        const transcript = await stophy.transcript(video.videoUrl);

        results.push({
          content: transcript.data.text.slice(0, MAX_TRANSCRIPT_CHARS),
          metadata: {
            title: video.author
              ? `${video.title} — ${video.author} (YouTube)`
              : `${video.title} (YouTube)`,
            url: video.videoUrl,
          },
        });

        readUrlsThisCall.push(video.videoUrl);
      } catch (err: any) {
        if (err?.code !== "NOT_FOUND") {
          console.log(
            "Error fetching transcript for",
            video.videoUrl,
            err?.message ?? err,
          );
        }
      }
    }

    if (readUrlsThisCall.length > 0) {
      additionalConfig.emitSubStep({
        type: "reading",
        urls: readUrlsThisCall,
      });
    }

    const readUrls = new Set(results.map((r) => r.metadata.url));

    uniqueVideos
      .filter((v) => !readUrls.has(v.videoUrl))
      .slice(0, 6)
      .forEach((v) => {
        results.push({
          content: v.description || v.title,
          metadata: {
            title: v.author
              ? `${v.title} — ${v.author} (YouTube)`
              : `${v.title} (YouTube)`,
            url: v.videoUrl,
          },
        });
      });

    return {
      type: "search_results",
      results,
    };
  },
};

export default youtubeSearchAction;
