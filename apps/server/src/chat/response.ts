import {
  APICallError,
  createAgentUIStream,
  createIdGenerator,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type FinishReason,
  type InferUIMessageChunk,
  isStepCount,
  type LanguageModel,
  type LanguageModelUsage,
  Output,
  smoothStream,
  streamText,
  ToolLoopAgent,
  type UIMessageStreamOutcome,
} from "ai";
import { z } from "zod";
import type { ProviderOptions } from "../chatgpt/codex";
import type { Event } from "../events";
import { citations } from "./citations";
import { keepAlive } from "./keepAlive";
import { readPdfs } from "./pdf";
import { reasonOf } from "../respond";
import type { ChatMessage, Mode } from "../shared/messages";
import type { Settings } from "../shared/settings";
import { shortenEarlierResults } from "./history";
import { answerRules, searchPrompt } from "./prompt";
import { type Remember, sirathicTools } from "./tools";

const KEEPALIVE_MS = 15_000;
const MAX_STEPS = 10;
const RESEARCH_STEPS = 16;

function answerAgent({
  model,
  modelName,
  tools,
  mode,
  settings,
  rules,
  mustSearch,
  canRemember,
  shorten,
  answerOptions,
}: {
  model: LanguageModel;
  modelName: string;
  tools: ReturnType<typeof sirathicTools>;
  mode: Mode;
  settings: Settings;
  rules: string;
  mustSearch: boolean;
  canRemember: boolean;
  shorten: ReturnType<typeof shortenEarlierResults>;
  answerOptions: ProviderOptions;
}) {
  const usable = Object.keys(tools).filter((name): name is keyof typeof tools => name in tools);
  return new ToolLoopAgent({
    model,
    instructions: searchPrompt(new Date(), mode, modelName, settings),
    tools,
    stopWhen: isStepCount(mode === "research" ? RESEARCH_STEPS : MAX_STEPS),
    allowSystemInMessages: true,
    prepareStep: ({ stepNumber, steps, initialMessages, responseMessages }) => {
      const searchFirst = stepNumber === 0 && mustSearch;
      const remembered = steps.some((step) =>
        step.toolCalls.some((call) => call.toolName === "remember"),
      );
      const activeTools = usable.filter(
        (name) => name !== "remember" || (canRemember && !(searchFirst || remembered)),
      );
      return searchFirst
        ? { toolChoice: "required", activeTools }
        : {
            activeTools,
            messages: [
              ...initialMessages.map(shorten),
              ...responseMessages,
              { role: "system", content: rules },
            ],
          };
    },
    providerOptions:
      settings.answerLength === "short"
        ? answerOptions
        : {
            ...answerOptions,
            openai: { ...answerOptions.openai, textVerbosity: "medium" },
          },
  });
}

const RELATED_LIMIT = 5;
const RELATED_PROMPT =
  "Suggest 4 short follow-up questions the user might ask next. Each under 10 words. Don't repeat the question or anything the answer already covers.";

const lastQuestion = (messages: ChatMessage[]) =>
  messages
    .findLast((message) => message.role === "user")
    ?.parts.map((part) => (part.type === "text" ? part.text : ""))
    .join("") ?? "";

function relatedQuestions(
  model: LanguageModel,
  conversation: string,
  providerOptions: ProviderOptions,
  abortSignal: AbortSignal,
) {
  const result = streamText({
    model,
    instructions: RELATED_PROMPT,
    prompt: conversation,
    output: Output.array({ element: z.string(), maxItems: RELATED_LIMIT }),
    providerOptions,
    abortSignal,
  });
  return result.output.then(
    (questions) => questions,
    (err: Error) => {
      console.warn(`related questions skipped: ${err.message}`);
      return undefined;
    },
  );
}

export function chatResponse({
  models,
  modelName,
  messages,
  mode,
  abortSignal,
  preferences,
  options,
  title,
  save,
  record,
  remember,
}: {
  models: { model: LanguageModel; small: LanguageModel };
  options: { answer: ProviderOptions; side: ProviderOptions };
  modelName: string;
  messages: ChatMessage[];
  mode: Mode;
  abortSignal: AbortSignal;
  preferences: Promise<Settings>;
  title: Promise<string | undefined> | undefined;
  save: (messages: ChatMessage[]) => Promise<void>;
  record: (event: Event) => void;
  remember: Remember | undefined;
}) {
  const startedAt = performance.now();
  const since = () => Math.round(performance.now() - startedAt);
  const calls = new Map<string, { tool: string; at: number }>();
  let failedTools = 0;
  let ended: { outcome: UIMessageStreamOutcome; finishReason?: FinishReason } | undefined;
  let firstTextMs: number | undefined;
  let httpStatus: number | undefined;
  let usage: LanguageModelUsage | undefined;
  let text = "";
  const sources = citations(messages);
  const shorten = shortenEarlierResults(messages, sources.numberOf);
  const tools = sirathicTools(sources.add, remember);
  const recent = messages
    .filter((message) => message.role === "user")
    .slice(-2)
    .map((message) =>
      message.parts.map((part) => (part.type === "text" ? part.text : "")).join(" "),
    )
    .join(" ");
  const mustSearch = messages.filter((message) => message.role === "user").length === 1;
  const messageId = createIdGenerator({ prefix: "msg", size: 16 });
  const stream = createUIMessageStream<ChatMessage>({
    originalMessages: messages,
    generateId: messageId,
    execute: async ({ writer }) => {
      writer.write({
        type: "start",
        messageId: messageId(),
        messageMetadata: { createdAt: Date.now(), mode, model: modelName },
      });
      let streaming = true;
      void title?.then((named) => {
        if (streaming && named) {
          writer.write({
            type: "data-title",
            data: { title: named },
            transient: true,
          });
        }
      });
      const settings = await preferences;
      const agent = answerAgent({
        model: models.model,
        modelName,
        tools,
        mode,
        settings,
        rules: answerRules(settings, recent),
        mustSearch,
        canRemember: remember !== undefined,
        shorten,
        answerOptions: options.answer,
      });
      const answer = await createAgentUIStream({
        agent,
        uiMessages: await readPdfs(messages),
        originalMessages: messages,
        abortSignal,
        experimental_transform: [sources.transform(), smoothStream({ chunking: "word" })],
        onEnd: ({ outcome, finishReason }) => {
          ended = { outcome, finishReason };
        },
        messageMetadata: ({ part }) => {
          if (part.type === "finish") usage = part.totalUsage;
          return undefined;
        },
        onError: (error) => {
          if (APICallError.isInstance(error)) {
            httpStatus = error.statusCode;
            return `${error.statusCode ?? "error"}: ${error.message || error.responseBody || "the model call failed"}`;
          }
          return error instanceof Error ? error.message : String(error);
        },
      });
      let related: ReturnType<typeof relatedQuestions> | undefined;
      let finish: InferUIMessageChunk<ChatMessage> | undefined;
      for await (const chunk of answer) {
        if (chunk.type === "start") continue;
        if (chunk.type === "finish") finish = chunk;
        else writer.write(chunk);
        if (chunk.type === "text-delta") {
          firstTextMs ??= since();
          text += chunk.delta;
        }
        if (chunk.type === "tool-input-available") {
          calls.set(chunk.toolCallId, {
            tool: chunk.toolName,
            at: performance.now(),
          });
        }
        if (chunk.type === "tool-output-available" || chunk.type === "tool-output-error") {
          const call = calls.get(chunk.toolCallId);
          const ok = chunk.type === "tool-output-available";
          if (!ok) failedTools += 1;
          if (call) {
            record({
              name: "tool.completed",
              props: {
                tool: call.tool,
                ms: Math.round(performance.now() - call.at),
                ok,
              },
            });
          }
        }
        if (chunk.type === "tool-output-available" && !related) {
          related = relatedQuestions(
            models.small,
            lastQuestion(messages),
            options.side,
            abortSignal,
          );
        }
      }
      const questions = text ? await related : undefined;
      if (questions?.length) {
        writer.write({ type: "data-related", data: { questions } });
      }
      streaming = false;
      if (finish) writer.write(finish);
    },
    onError: (error) => (error instanceof Error ? error.message : String(error)),
    onEnd: ({ messages: answered, outcome }) => {
      record({
        name: "answer.completed",
        props: {
          mode,
          model: modelName,
          outcome: ended?.outcome.status ?? outcome.status,
          finishReason: ended?.finishReason,
          httpStatus,
          totalMs: since(),
          firstTextMs,
          toolCalls: calls.size,
          failedTools,
          cited: new Set(text.match(/\[\d+\]/g)).size,
          words: text.split(/\s+/).filter(Boolean).length,
          inputTokens: usage?.inputTokens,
          cachedInputTokens: usage?.inputTokenDetails.cacheReadTokens,
          outputTokens: usage?.outputTokens,
          reasoningTokens: usage?.outputTokenDetails.reasoningTokens,
        },
      });
      return save(answered).catch((err: Error) => {
        console.error(`session not saved: ${reasonOf(err)}`);
      });
    },
  });
  const response = createUIMessageStreamResponse({
    stream,
    headers: { "cache-control": "no-cache, no-transform" },
  });
  return new Response(response.body?.pipeThrough(keepAlive(KEEPALIVE_MS)) ?? null, response);
}
