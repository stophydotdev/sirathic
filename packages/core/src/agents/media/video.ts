import { generateText, type LanguageModel, Output } from "ai";
import z from "zod";
import {
  videoSearchFewShots,
  videoSearchPrompt,
} from "@sirathic/core/prompts/media/video";
import { getStophy } from "@sirathic/core/stophy";
import type { ChatTurnMessage } from "@sirathic/core/types";
import formatChatHistoryAsString from "@sirathic/core/utils/formatHistory";

type VideoSearchInput = {
  chatHistory: ChatTurnMessage[];
  query: string;
};

type VideoSearchResult = {
  url: string;
  title: string;
  author: string | null;
  thumbnail: string | null;
  durationText: string | null;
  viewCountText: string | null;
  publishedAtText: string | null;
};

const schema = z.object({
  query: z.string().describe("The video search query."),
});

const searchVideos = async (
  input: VideoSearchInput,
  llm: LanguageModel,
): Promise<VideoSearchResult[]> => {
  const { output } = await generateText({
    model: llm,
    instructions: videoSearchPrompt,
    messages: [
      ...videoSearchFewShots,
      {
        role: "user",
        content: `<conversation>\n${formatChatHistoryAsString(input.chatHistory)}\n</conversation>\n<follow_up>\n${input.query}\n</follow_up>`,
      },
    ],
    output: Output.object({ schema }),
  });

  const res = await getStophy().search(output.query, { type: "video" });

  const videos: VideoSearchResult[] = [];

  res.data.items.forEach((item) => {
    if (item.type !== "video") return;

    videos.push({
      url: item.videoUrl,
      title: item.title,
      author: item.author,
      thumbnail: item.thumbnails[item.thumbnails.length - 1]?.url ?? null,
      durationText: item.durationText,
      viewCountText: item.viewCountText,
      publishedAtText: item.publishedAtText,
    });
  });

  return videos.slice(0, 12);
};

export default searchVideos;
