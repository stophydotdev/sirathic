import searchVideos from "@sirathic/core/agents/media/video";
import { getLLM } from "@sirathic/core/models";
import type { ChatTurnMessage } from "@sirathic/core/types";
import z from "zod";
import { publicProcedure, router } from "../index";

const inputSchema = z.object({
  query: z.string().min(1),
  chatHistory: z
    .array(z.tuple([z.enum(["human", "assistant"]), z.string()]))
    .optional()
    .default([]),
  model: z.string().optional(),
});

export const videosRouter = router({
  search: publicProcedure.input(inputSchema).mutation(async ({ input }) => {
    const chatHistory: ChatTurnMessage[] = input.chatHistory.map(
      ([role, content]) => ({
        role: role === "human" ? "user" : "assistant",
        content,
      }),
    );

    const videos = await searchVideos(
      { chatHistory, query: input.query },
      getLLM(input.model),
    );

    return { videos };
  }),
});
