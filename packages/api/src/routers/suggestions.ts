import z from "zod";
import generateSuggestions from "@sirathic/core/agents/suggestions";
import { getLLM } from "@sirathic/core/models";
import type { ChatTurnMessage } from "@sirathic/core/types";
import { publicProcedure, router } from "../index";

const inputSchema = z.object({
  chatHistory: z.array(z.tuple([z.enum(["human", "assistant"]), z.string()])),
  model: z.string().optional(),
});

export const suggestionsRouter = router({
  generate: publicProcedure.input(inputSchema).mutation(async ({ input }) => {
    const chatHistory: ChatTurnMessage[] = input.chatHistory.map(
      ([role, content]) => ({
        role: role === "human" ? "user" : "assistant",
        content,
      }),
    );

    const suggestions = await generateSuggestions(
      { chatHistory },
      getLLM(input.model),
    );

    return { suggestions };
  }),
});
