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
