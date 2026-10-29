import { z } from "zod";
import type { ChatMessage } from "../shared/messages";

const withText = z.looseObject({ text: z.string() });

const blankText = (items: unknown[]) =>
  items.map((item) => {
    const parsed = withText.safeParse(item);
    return parsed.success ? { ...parsed.data, text: "" } : item;
  });

export const withoutPageText = (messages: ChatMessage[]) =>
  messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) => {
      if (part.type !== "tool-search_web" || part.state !== "output-available") return part;
      const results = Object.entries(part.output.results).map(
        ([kind, items]) => [kind, blankText(items)] as const,
      );
      return {
        ...part,
        output: { ...part.output, text: "", results: Object.fromEntries(results) },
      };
    }),
  }));

export const withStoredPageText = (messages: ChatMessage[], stored: ChatMessage[]) => {
  const outputs = new Map(
    stored.flatMap((message) =>
      message.parts.flatMap((part) =>
        part.type === "tool-search_web" && part.state === "output-available"
          ? [[part.toolCallId, part.output] as const]
          : [],
      ),
    ),
  );
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) => {
      if (part.type !== "tool-search_web" || part.state !== "output-available") return part;
      return { ...part, output: outputs.get(part.toolCallId) ?? part.output };
    }),
  }));
};
