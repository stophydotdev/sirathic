import { tool } from "ai";
import { z } from "zod";
import { searchPastChats } from "./sessions";

export const pastChatTools = (owner: string, sessionId: string) => ({
  search_past_chats: tool({
    description:
      "Searches the user's earlier chats with you by words in their titles and messages. Use it when the user refers to an earlier conversation, or when what they asked before would change this answer. Returns up to 5 chats, newest first, with the date, the title, the first question and how the last answer began.",
    inputSchema: z.object({
      query: z
        .string()
        .trim()
        .min(1)
        .describe("A word or short phrase to look for, in the language of the earlier chat."),
    }),
    execute: async ({ query }) => {
      const found = await searchPastChats(owner, sessionId, query);
      return found.length === 0
        ? "No earlier chat matches."
        : found
            .map(
              (chat) =>
                `${chat.updatedAt.slice(0, 10)}: ${chat.title}\nAsked: ${chat.asked}\nAnswered: ${chat.answered}`,
            )
            .join("\n\n");
    },
  }),
});
