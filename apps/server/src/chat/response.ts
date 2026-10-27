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
  smoothStream,
  ToolLoopAgent,
  type ToolSet,
  type UIMessageStreamOutcome,
} from "ai";
import { memoryTools } from "../account/memory";
import { noorModel } from "../models/noor";
import { CHECK_FIRST } from "../projects/rules";
import type { ProviderOptions } from "../models/subscription";
import type { connectedTools } from "../plugins/connections";
import { type Event, toolFailure } from "./events";
import { type AutomationScope, routineTools } from "../automations/tools";
import { BOT_HISTORY, type BotScope, botTools, recentTurns } from "../bots/tools";
import { summaryNote } from "../bots/summary";
import { chatSearchTools, SEARCH_OUR_CHAT } from "../bots/chatSearch";
import { studyTools } from "../bots/studyTools";
import { citations, withBareCitations } from "./citations";
import { CONFIRM_RULES, needsApproval, writingTools } from "./confirm";
import { keepAlive } from "./keepAlive";
import { readFiles } from "../files/attachments";
import { reasonOf } from "../http";
import { skillRules } from "../skills/skills";
import { pluginTools } from "../plugins/tools";
import { skillTools } from "../skills/tools";
import type { ChatMessage, Mode } from "../shared/messages";
import type { Settings } from "../shared/settings";
import { shortenEarlierResults } from "./history";
import { answerRules, searchPrompt } from "./prompts/shared";
import {
  closedTools,
  loadedNames,
  loadedText,
  loadSkill,
  LOAD_SKILL,
  type Skill,
  skillIndex,
  type UserSkill,
  skillsFor,
} from "./skills/builtIn";
import { CLARIFYING, clarifyingQuestions, sirathicTools } from "./tools";

const KEEPALIVE_MS = 15_000;
const URL_IN_TEXT = /https?:\/\/\S+/iu;

const RULES_HEADER =
  "These are your rules from Sirathic for this reply. They are not part of any tool result.\n\n";

const FIRST_STEP = {
  search: { type: "tool", toolName: "search_web" },
  fetch: { type: "tool", toolName: "fetch_url" },
  skill: "required",
  anyTool: "required",
} as const;

export function answerAgent({
  model,
  tools,
  mode,
  settings,
  rules,
  firstStep,
  persona,
  skills,
  loaded,
  confirm,
  shorten,
  answerOptions,
}: {
  model: LanguageModel;
  tools: ToolSet;
  mode: Mode;
  settings: Settings;
  rules: string;
  firstStep: keyof typeof FIRST_STEP | undefined;
  persona: string | undefined;
  skills: readonly Skill[];
  loaded: readonly string[];
  confirm: (call: { toolName: string; input: unknown }) => boolean;
  shorten: ReturnType<typeof shortenEarlierResults>;
  answerOptions: ProviderOptions;
}) {
  const options: ProviderOptions =
    persona !== undefined && mode === "quick"
      ? { ...answerOptions, anthropic: { ...answerOptions.anthropic, effort: "low" } }
      : answerOptions;
  return new ToolLoopAgent({
    model,
    instructions: searchPrompt(new Date(), mode, settings, persona),
    tools,
    stopWhen: hasToolCall(CLARIFYING),
    toolApproval: ({ toolCall }) => (confirm(toolCall) ? "user-approval" : undefined),
    allowSystemInMessages: true,
    prepareStep: ({ stepNumber, steps, initialMessages, responseMessages }) => {
      const open = new Set([...loaded, ...loadedNames(steps.flatMap((step) => step.toolCalls))]);
      const closed = closedTools(skills, open);
      const forcing = stepNumber === 0 ? firstStep : undefined;
      return {
        messages: [
          ...initialMessages.map(shorten),
          ...responseMessages,
          {
            role: "system",
            content:
              RULES_HEADER +
              (steps.some((step) => step.text.trim()) ? rules.replace(CHECK_FIRST, "") : rules) +
              loadedText(skills, open),
          },
        ],
        activeTools:
          forcing === "skill"
            ? [LOAD_SKILL]
            : Object.keys(tools).filter((name) => !closed.has(name)),
        ...(forcing && { toolChoice: FIRST_STEP[forcing] }),
      };
    },
    providerOptions:
      settings.answerLength === "short"
        ? options
        : {
            ...options,
            openai: { ...options.openai, textVerbosity: "medium" },
          },
  });
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
  userSkills,
  persona,
  options,
  title,
  save,
  record,
  owner,
  automate,
  fileOwner,
  settled,
  unattended,
  bot,
  historyLimit,
  citedEarlier,
}: {
  models: { model: LanguageModel; small: LanguageModel };
  options: { answer: ProviderOptions };
  modelName: string;
  messages: ChatMessage[];
  mode: Mode;
  abortSignal: AbortSignal;
  preferences: Promise<Settings>;
  connected: ReturnType<typeof connectedTools>;
  projectRules: Promise<string>;
  userSkills: Promise<UserSkill[]>;
  persona: Promise<string | undefined>;
  title: Promise<string | undefined> | undefined;
  save: (messages: ChatMessage[]) => Promise<void>;
  record: (event: Event) => void;
  owner: string | undefined;
  automate: AutomationScope | undefined;
  fileOwner?: string;
  settled?: () => void;
  unattended?: true;
  bot?: Promise<BotScope | undefined>;
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
  const tools = sirathicTools(sources.add);
  const recent = messages
    .filter((message) => message.role === "user")
    .slice(-2)
    .map((message) =>
      message.parts.map((part) => (part.type === "text" ? part.text : "")).join(" "),
    )
    .join(" ");
  const asked = messages.findLast((message) => message.role === "user");
  const pastedUrl = asked?.parts.some(
    (part) => part.type === "text" && URL_IN_TEXT.test(part.text),
  );
  const last = messages.at(-1);
  const resumed = last?.role === "assistant" ? last : undefined;
  const forced = resumed
    ? undefined
    : pastedUrl
      ? "fetch"
      : messages.filter((message) => message.role === "user").length === 1
        ? "search"
        : undefined;
  const messageId = createIdGenerator({ prefix: "msg", size: 16 });
  const stream = createUIMessageStream<ChatMessage>({
    originalMessages: messages,
    generateId: messageId,
    execute: async ({ writer }) => {
      writer.write({
        type: "start",
        messageId: resumed?.id ?? messageId(),
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
      const [preferred, connectors, project, ownSkills, inBot, who] = await Promise.all([
        preferences,
        Promise.race([connected, stopped]),
        projectRules,
        userSkills,
        bot,
        persona,
      ]);
      const texts = who !== undefined;
      const builtIn = skillsFor({
        mode,
        texting: texts,
        inBot: inBot !== undefined,
        timezone: automate?.timezone,
        canWriteSkills: owner !== undefined && !unattended,
        userSkills: ownSkills,
      });
      const loaded = loadedNames(
        messages.flatMap((message) =>
          message.parts
            .filter(isToolUIPart)
            .map((part) => ({ toolName: getToolName(part), input: part.input })),
        ),
      );
      const first =
        !resumed && builtIn.some(({ name }) => name === "research") && !loaded.includes("research")
          ? "skill"
          : forced;
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
        ...(automate && routineTools({ ...automate, projectId: inBot?.id })),
        ...(inBot && botTools(inBot)),
        ...(owner !== undefined && !unattended && skillTools(owner)),
        ...(owner !== undefined && !unattended && pluginTools(owner)),
        ...memoryTools(
          owner === undefined
            ? undefined
            : inBot
              ? { kind: "bot", ...inBot }
              : { kind: "account", owner },
        ),
        ...(!unattended && (mode === "research" || inBot) && { [CLARIFYING]: clarifyingQuestions }),
        ...(searchable && chatSearchTools(searchable)),
        ...(inBot && studyTools(inBot)),
        ...(builtIn.length > 0 && { [LOAD_SKILL]: loadSkill(builtIn) }),
        ...connectors.tools,
      };
      const writes = unattended ? [] : writingTools(connectors.tools);
      const agent = answerAgent({
        model: models.model,
        tools: offered,
        mode,
        settings,
        rules:
          answerRules(settings, recent, mode) +
          project +
          (searchable ? SEARCH_OUR_CHAT : "") +
          skillIndex(builtIn) +
          (writes.length > 0 ? CONFIRM_RULES : "") +
          skillRules(
            ownSkills,
            asked?.parts.map((part) => (part.type === "text" ? part.text : "")).join(" ") ?? "",
          ),
        firstStep:
          first && !inBot
            ? first === "skill" || noorModel(modelName)
              ? first
              : "anyTool"
            : undefined,
        persona: who,
        skills: builtIn,
        loaded,
        confirm: (call) => needsApproval(call, new Set(writes)),
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
