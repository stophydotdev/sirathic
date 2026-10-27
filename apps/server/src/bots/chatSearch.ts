import { tool } from "ai";
import { z } from "zod";
import { unlinked } from "../chat/citations";
import { messagesOf } from "../chat/sessions";
import type { ChatMessage } from "../shared/messages";
import type { BotScope } from "./tools";

const MAX_MATCHES = 4;
const SNIPPET_CHARS = 240;

export const SEARCH_OUR_CHAT =
  " Older turns of this chat drop out of your view, and short notes on them come first. When they ask about something said earlier that you can no longer see, use searchOurChat to find it.";
const MIN_WORD = 3;

export const textOf = (message: ChatMessage) =>
  unlinked(
    message.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("")
      .trim(),
  );

const wordsOf = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= MIN_WORD);

export function findInChat(messages: ChatMessage[], query: string) {
  const wanted = [...new Set(wordsOf(query))].toSorted((a, b) => b.length - a.length);
  const earlier = messages.slice(
    0,
    messages.findLastIndex((message) => message.role === "user"),
  );
  return earlier
    .flatMap((message, index) => {
      const text = textOf(message);
      const lower = text.toLowerCase();
      const hits = wanted.filter((word) => lower.includes(word));
      const [best] = hits;
      if (best === undefined) return [];
      const start = Math.max(0, lower.indexOf(best) - SNIPPET_CHARS / 3);
      const createdAt = message.metadata?.createdAt;
      return [
        {
          score: hits.length,
          index,
          match: {
            from: message.role === "user" ? "user" : "you",
            date:
              createdAt === undefined ? undefined : new Date(createdAt).toISOString().slice(0, 10),
            snippet: text.slice(start, start + SNIPPET_CHARS),
          },
        },
      ];
    })
    .toSorted((a, b) => b.score - a.score || b.index - a.index)
    .slice(0, MAX_MATCHES)
    .map(({ match }) => match);
}

export const chatSearchTools = ({ id, owner }: BotScope) => ({
  searchOurChat: tool({
    description:
      "Searches everything said earlier in this chat with the user, including turns you can no longer see. Use it when they ask about something from before, like the hadith you taught them last week. Pass a few distinctive keywords, not a sentence. Returns up to four short snippets with dates, newest first among equal matches. Snippets are what was said back then, so look the source up again before you repeat a verse, hadith or ruling.",
    inputSchema: z.object({ query: z.string().trim().min(MIN_WORD).max(200) }),
    execute: async ({ query }) => ({
      matches: findInChat((await messagesOf(id, owner)).messages, query),
    }),
  }),
});
