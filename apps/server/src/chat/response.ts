import {
  APICallError,
  consumeStream,
  createAgentUIStream,
  createIdGenerator,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type FinishReason,
  getToolName,
  hasToolCall,
  type InferUIMessageChunk,
  isToolUIPart,
  type LanguageModel,
  type LanguageModelUsage,
  type ModelMessage,
  Output,
  smoothStream,
  streamText,
  ToolLoopAgent,
  type ToolSet,
  type UIMessageStreamOutcome,
} from "ai";
import { z } from "zod";
import { noorModel } from "../models/noor";
import { CHECK_FIRST } from "../projects/rules";
import type { ProviderOptions } from "../models/subscription";
import type { connectedTools } from "../plugins/connections";
import { type Event, toolFailure } from "./events";
import { type AutomationScope, automationTools } from "../automations/tools";
import { BOT_HISTORY, type BotScope, botTools, recentTurns } from "../bots/tools";
import { summaryNote } from "../bots/summary";
import { chatSearchTools, SEARCH_OUR_CHAT } from "../bots/chatSearch";
import { STUDY_RULES, studyTools } from "../bots/studyTools";
import { citations, withBareCitations } from "./citations";
import { keepAlive } from "./keepAlive";
import { readFiles } from "../files/attachments";
import { reasonOf } from "../http";
import type { ChatMessage, Mode } from "../shared/messages";
import type { Settings } from "../shared/settings";
import { shortenEarlierResults } from "./history";
import { answerRules, searchPrompt } from "./prompts/shared";
import { type Remember, sirathicTools } from "./tools";

const KEEPALIVE_MS = 15_000;

const RULES_HEADER =
  "These are your rules from Sirathic for this reply. They are not part of any tool result.\n\n";

const FIRST_STEP = {
  search: { type: "tool", toolName: "search" },
  anyTool: "required",
} as const;

const GROUPS = [
  {
    kind: "routine",
    names: ["createAutomation", "listAutomations"],
    when: /\b(remind\w*|routines?|schedul\w*|automat\w*|daily|weekly|every (day|morning|evening|night|week|month|\w+day))\b/iu,
    rules: "",
  },
  {
    kind: "study",
    names: ["addStudyItem", "dueStudyItems", "gradeStudyItem"],
    when: /\b(memori[sz]\w*|hifz|revis\w*|review\w*|quiz\w*|stud(y|ies|ying)|flashcards?)\b/iu,
    rules: STUDY_RULES,
  },
] as const;

const deferred = new Set<string>(GROUPS.flatMap((group) => group.names));

export const groupRules = (needed: Needs, offered: ToolSet) =>
  GROUPS.filter(({ kind, names }) => needed.includes(kind) && names.some((name) => name in offered))
    .map(({ rules }) => rules)
    .join("");

export type Needs = ReturnType<typeof neededTools>;

export const neededTools = (messages: ChatMessage[], job: string, language: string | undefined) => {
  const said = `${job} ${messages
    .slice(-2)
    .flatMap((message) =>
      message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])),
    )
    .join(" ")}`;
  const used = new Set(
    messages.flatMap((message) => message.parts.filter(isToolUIPart).map(getToolName)),
  );
  return GROUPS.filter(
    ({ names, when }) =>
      language !== "en" || when.test(said) || names.some((name) => used.has(name)),
  ).map(({ kind }) => kind);
};

const deferLoading = (entry: ToolSet[string]) => ({
  ...entry,
  providerOptions: {
    ...entry.providerOptions,
    anthropic: { ...entry.providerOptions?.anthropic, deferLoading: true },
  },
});

export function answerAgent({
  model,
  tools,
  mode,
  settings,
  rules,
  firstStep,
  canRemember,
  persona,
  added,
  shorten,
  answerOptions,
}: {
  model: LanguageModel;
  tools: ToolSet;
  mode: Mode;
  settings: Settings;
  rules: string;
  firstStep: keyof typeof FIRST_STEP | undefined;
  canRemember: boolean;
  persona: string | undefined;
  added: readonly string[];
  shorten: ReturnType<typeof shortenEarlierResults>;
  answerOptions: ProviderOptions;
}) {
  const available = Object.fromEntries(
    Object.entries(tools).flatMap(([name, entry]): [string, ToolSet[string]][] =>
      name === "remember" && !canRemember
        ? []
        : [[name, deferred.has(name) ? deferLoading(entry) : entry]],
    ),
  );
  const toolChanges = added
    .filter((toolName) => toolName in available)
    .map((toolName) => ({ type: "tool_addition", toolName }));
  const options: ProviderOptions =
    persona !== undefined && mode === "quick"
      ? { ...answerOptions, anthropic: { ...answerOptions.anthropic, effort: "low" } }
      : answerOptions;
  const addTools: ModelMessage[] =
    toolChanges.length > 0
      ? [{ role: "system", content: "", providerOptions: { anthropic: { toolChanges } } }]
      : [];
  return new ToolLoopAgent({
    model,
    instructions: searchPrompt(new Date(), mode, settings, persona),
    tools: available,
    stopWhen: hasToolCall("askUser"),
    allowSystemInMessages: true,
    prepareStep: ({ stepNumber, steps, initialMessages, responseMessages }) => ({
      messages: [
        ...initialMessages.map(shorten),
        ...addTools,
        ...responseMessages,
        {
          role: "system",
          content:
            RULES_HEADER +
            (steps.some((step) => step.text.trim()) ? rules.replace(CHECK_FIRST, "") : rules),
        },
      ],
      ...(stepNumber === 0 && firstStep && { toolChoice: FIRST_STEP[firstStep] }),
    }),
    providerOptions:
      settings.answerLength === "short"
        ? options
        : {
            ...options,
            openai: { ...options.openai, textVerbosity: "medium" },
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
  connected,
  projectRules,
  skillRules,
  persona,
  options,
  title,
  save,
  record,
  remember,
  automate,
  fileOwner,
  settled,
  bot,
  needs,
  historyLimit,
  citedEarlier,
}: {
  models: { model: LanguageModel; small: LanguageModel };
  options: { answer: ProviderOptions; side: ProviderOptions };
  modelName: string;
  messages: ChatMessage[];
  mode: Mode;
  abortSignal: AbortSignal;
  preferences: Promise<Settings>;
  connected: ReturnType<typeof connectedTools>;
  projectRules: Promise<string>;
  skillRules: Promise<string>;
  persona: Promise<string | undefined>;
  title: Promise<string | undefined> | undefined;
  save: (messages: ChatMessage[]) => Promise<void>;
  record: (event: Event) => void;
  remember: Remember | undefined;
  automate: AutomationScope | undefined;
  fileOwner?: string;
  settled?: () => void;
  bot?: Promise<BotScope | undefined>;
  needs?: Promise<Needs>;
  historyLimit?: number;
  citedEarlier?: ChatMessage[];
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
  const sources = citations([...(citedEarlier ?? []), ...messages]);
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
      const stopped = new Promise<never>((_, reject) => {
        abortSignal.addEventListener("abort", () => reject(abortSignal.reason), { once: true });
      });
      const [preferred, connectors, project, skills, inBot, who, needed = []] = await Promise.all([
        preferences,
        Promise.race([connected, stopped]),
        projectRules,
        skillRules,
        bot,
        persona,
        needs,
      ]);
      const texts = who !== undefined;
      const added = GROUPS.filter(({ kind }) => needed.includes(kind)).flatMap(
        ({ names }) => names,
      );
      const settings = texts
        ? ({ ...preferred, answerLength: "short" } satisfies Settings)
        : preferred;
      const visible = recentTurns(
        messages,
        historyLimit ?? (inBot ? BOT_HISTORY : messages.length),
      );
      const searchable = inBot && visible.length < messages.length ? inBot : undefined;
      const offered = {
        ...tools,
        ...(automate && automationTools({ ...automate, projectId: inBot?.id })),
        ...(inBot && botTools(inBot)),
        ...(searchable && chatSearchTools(searchable)),
        ...(inBot && studyTools(inBot)),
        ...connectors.tools,
      };
      const agent = answerAgent({
        model: models.model,
        tools: offered,
        mode,
        settings,
        rules:
          answerRules(settings, recent, mode, texts) +
          (automate && added.includes("createAutomation")
            ? `\n\nThe user's time zone is ${automate.timezone}.`
            : "") +
          project +
          (searchable ? SEARCH_OUR_CHAT : "") +
          groupRules(needed, offered) +
          skills,
        firstStep: mustSearch && !inBot ? (noorModel(modelName) ? "search" : "anyTool") : undefined,
        canRemember: remember !== undefined,
        persona: who,
        added,
        shorten,
        answerOptions: options.answer,
      });
      const answer = await createAgentUIStream({
        agent,
        uiMessages: [
          ...(inBot ? await summaryNote(inBot) : []),
          ...(await readFiles(visible.map(withBareCitations), fileOwner)),
        ],
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
                ...(chunk.type === "tool-output-error" && {
                  failure: toolFailure(chunk.errorText),
                }),
              },
            });
          }
        }
        if (chunk.type === "tool-output-available" && !related && !inBot) {
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
      void connected.then(({ close }) => close());
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
    consumeSseStream: ({ stream: copy }) => consumeStream({ stream: copy }).then(settled),
  });
  return new Response(response.body?.pipeThrough(keepAlive(KEEPALIVE_MS)) ?? null, response);
}
