import { isToolUIPart, type ModelMessage } from "ai";
import { z } from "zod";
import type { ChatMessage } from "../shared/messages";
import { source } from "../shared/sources";

const STALE = "Earlier results, removed to save space.";
const withSources = z.object({ sources: z.array(source) });

export function shortenEarlierResults(
  history: ChatMessage[],
  numberOf: (url: string) => number | undefined,
) {
  const answered = history.slice(
    0,
    history.findLastIndex((message) => message.role === "user"),
  );
  const notes = new Map(
    answered.flatMap((message) =>
      message.parts.flatMap((part) => {
        if (!isToolUIPart(part) || part.state !== "output-available") {
          return [];
        }
        const listed = withSources.safeParse(part.output).data?.sources ?? [];
        const cited = new Map(
          listed.flatMap(({ url, title }) => {
            const number = numberOf(url);
            return number === undefined ? [] : [[number, title]];
          }),
        );
        const list = [...cited]
          .toSorted(([a], [b]) => a - b)
          .map(([number, title]) => `[${number}] ${title}`)
          .join("; ");
        return [
          [
            part.toolCallId,
            list
              ? `${STALE} Cited in the answer: ${list}. Search again if you need their full text.`
              : `${STALE} Search again if you need them.`,
          ],
        ];
      }),
    ),
  );
  return (message: ModelMessage): ModelMessage =>
    message.role === "tool"
      ? {
          ...message,
          content: message.content.map((part) => {
            if (part.type !== "tool-result") return part;
            const note = notes.get(part.toolCallId);
            return note === undefined
              ? part
              : { ...part, output: { type: "text" as const, value: note } };
          }),
        }
      : message;
}
