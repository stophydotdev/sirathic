import {
  type LanguageModel,
  type ModelMessage,
  smoothStream,
  streamText,
  type UIMessageStreamWriter,
} from "ai";
import type { ProviderOptions } from "../models/subscription";
import { type ChatMessage, messageText } from "../shared/messages";
import type { citations } from "./citations";
import { fencedText } from "./fence";
import type { instructions } from "./prompts/build";

const RESULTS_CHARS = 120_000;

export async function answerFromResults({
  model,
  system,
  asked,
  earlier,
  results,
  writer,
  transform,
  abortSignal,
  providerOptions,
}: {
  model: LanguageModel;
  system: ReturnType<typeof instructions>;
  asked: string;
  earlier: readonly ChatMessage[];
  results: readonly string[];
  writer: UIMessageStreamWriter<ChatMessage>;
  transform: ReturnType<ReturnType<typeof citations>["transform"]>;
  abortSignal: AbortSignal;
  providerOptions: ProviderOptions;
}) {
  const answer = streamText({
    model,
    instructions: system,
    messages: [
      ...earlier.flatMap((message): ModelMessage[] => {
        const content = messageText(message);
        if (!content) return [];
        if (message.role === "user") return [{ role: "user" as const, content }];
        return message.role === "assistant" ? [{ role: "assistant" as const, content }] : [];
      }),
      {
        role: "user" as const,
        content: `${asked}\n\nThe research ended without an answer. These are its tool results:\n\n${fencedText(results.join("\n\n").slice(-RESULTS_CHARS))}\n\nAnswer now from what you found, citing the results by the numbers they show in square brackets, and say what you could not check.`,
      },
    ],
    abortSignal,
    providerOptions,
    experimental_transform: [transform, smoothStream({ chunking: "word" })],
  });
  let text = "";
  for await (const chunk of answer.toUIMessageStream<ChatMessage>({
    sendStart: false,
    sendFinish: false,
  })) {
    if (chunk.type === "error" && !text) continue;
    writer.write(chunk);
    if (chunk.type === "text-delta") text += chunk.delta;
  }
  return { text, usage: await answer.totalUsage };
}
