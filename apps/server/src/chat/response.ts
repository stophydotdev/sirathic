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
  isStepCount,
  isToolUIPart,
  type LanguageModel,
  type LanguageModelUsage,
  smoothStream,
  ToolLoopAgent,
  type ToolSet,
  type UIMessageStreamOutcome,
} from "ai";
import { memoryTools } from "../account/memory";
import { pastChatTools } from "./pastChats";
import { noorModel } from "../models/noor";
import { countedTokens } from "../models/usage";
import type { RulesProject } from "../projects/rules";
import { answerOptions } from "../models/subscription";
import type { connectedTools } from "../plugins/connections";
import { type Event, toolFailure } from "./events";
import { type AutomationScope, routineTools } from "../automations/tools";
import { BOT_HISTORY, type BotScope, botTools, recentTurns } from "../bots/tools";
import { summaryNote } from "../bots/summary";
import { chatSearchTools, SEARCH_OUR_CHAT } from "../bots/chatSearch";
import { studyTools } from "../bots/studyTools";
import { islamicDates } from "../bots/islamicDates";
import { citations, withBareCitations } from "./citations";
import { codeTools } from "./codeTools";
import { needsApproval, writingTools } from "./confirm";
import { needsSources } from "./relevance";
import { listConnections } from "../plugins/connections";
import { fileTools, sandboxFiles } from "./fileTools";
import { keepAlive } from "./keepAlive";
import { readFiles } from "../files/attachments";
import { reasonOf } from "../http";
import { skillRules } from "../skills/skills";
import { pluginTools } from "../plugins/tools";
import { skillTools } from "../skills/tools";
import type { ChatMessage, Mode } from "../shared/messages";
import type { Settings } from "../shared/settings";
import { shortenEarlierResults } from "./history";
import { instructions } from "./prompts/build";
import {
  closedTools,
  loadedNames,
  loadedText,
  loadSkill,
  LOAD_SKILL,
  openedBy,
  type Skill,
  skillIndex,
  type UserSkill,
  skillsFor,
} from "./skills/builtIn";
import { STOPHY_LINK, stophyTools } from "./stophyTools";
import { CLARIFYING, clarifyingQuestions, sirathicTools } from "./tools";

const KEEPALIVE_MS = 15_000;
const STEP_CAP = 20;
const SAME_CALLS = 2;
const STALLED_MS = 120_000;
const RESEARCH_OPENS = ["research", "calculate", "files"];
const URL_IN_TEXT = /https?:\/\/\S+/iu;

type Turn = Parameters<typeof answerOptions>[0];

const RULES_HEADER =
  "These are your rules from Sirathic for this reply. They are not part of any tool result.\n\n";

const FIRST_STEP = {
  fetch: { type: "tool", toolName: "fetch_url" },
  anyTool: "required",
} as const;

export function answerAgent({
  model,
  tools,
  settings,
  instructions: system,
  mentioned,
  firstStep,
  skills,
  loaded,
  confirm,
  shorten,
  turn,
}: {
  model: LanguageModel;
  tools: ToolSet;
  settings: Settings;
  instructions: ReturnType<typeof instructions>;
  mentioned: string;
  firstStep: keyof typeof FIRST_STEP | undefined;
  skills: readonly Skill[];
  loaded: readonly string[];
  confirm: (call: { toolName: string; input: unknown }) => boolean;
  shorten: ReturnType<typeof shortenEarlierResults>;
  turn: Turn;
}) {
  const options = answerOptions(turn);
  const repeats = new Map<string, number>();
  const gated = Object.fromEntries(
    Object.entries(tools).map(([name, entry]) => {
      const { execute } = entry;
      return [
        name,
        execute === undefined
          ? entry
          : {
              ...entry,
              execute: (...call: Parameters<typeof execute>) => {
                const key = `${name} ${JSON.stringify(call[0])}`;
                const times = (repeats.get(key) ?? 0) + 1;
                repeats.set(key, times);
                if (times > SAME_CALLS) {
                  throw new Error(
                    `You already called ${name} with this input ${SAME_CALLS} times in this reply. Use those results or change the input.`,
                  );
                }
                return execute(...call);
              },
            },
      ];
    }),
  );
  return new ToolLoopAgent({
    model,
    instructions: system,
    tools: gated,
    stopWhen: [hasToolCall(CLARIFYING), isStepCount(STEP_CAP)],
    timeout: { chunkMs: STALLED_MS },
    toolApproval: ({ toolCall }) => (confirm(toolCall) ? "user-approval" : undefined),
    allowSystemInMessages: true,
    prepareStep: ({ stepNumber, steps, initialMessages, responseMessages }) => {
      const open = new Set([...loaded, ...loadedNames(steps.flatMap((step) => step.toolCalls))]);
      const closed = closedTools(skills, open);
      const forcing = stepNumber === 0 ? firstStep : undefined;
      const loadable = skills.filter(({ name }) => !open.has(name));
      const index =
        loadable.length > 0 ? `Skills you can load with load_skill:\n${skillIndex(loadable)}` : "";
      const skillText = (index + loadedText(skills, open) + mentioned).trim();
      const earlier = initialMessages.map(shorten);
      const asked = earlier.findLastIndex((message) => message.role === "user") + 1;
      return {
        messages: [
          ...earlier.slice(0, asked),
          ...(skillText ? [{ role: "system" as const, content: RULES_HEADER + skillText }] : []),
          ...earlier.slice(asked),
          ...responseMessages,
        ],
        activeTools: Object.keys(tools).filter((name) => !closed.has(name)),
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
  project,
  userSkills,
  turn,
  title,
  save,
  record,
  owner,
  automate,
  fileOwner,
  settled,
  spend,
  unattended,
  bot,
  historyLimit,
  citedEarlier,
}: {
  models: { model: LanguageModel; small: LanguageModel };
  turn: Turn;
  modelName: string;
  messages: ChatMessage[];
  mode: Mode;
  abortSignal: AbortSignal;
  preferences: Promise<Settings>;
  connected: ReturnType<typeof connectedTools>;
  project: Promise<RulesProject | undefined>;
  userSkills: Promise<UserSkill[]>;
  title: Promise<string | undefined> | undefined;
  save: (messages: ChatMessage[]) => Promise<void>;
  record: (event: Event) => void;
  owner: string | undefined;
  automate: AutomationScope | undefined;
  fileOwner?: string;
  settled?: () => void;
  spend?: (counted: number) => void;
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
  let counted = 0;
  let text = "";
  const sources = citations([...(citedEarlier ?? []), ...messages]);
  const shorten = shortenEarlierResults(messages);
  const tools = sirathicTools(sources.add);
  const asked = messages.findLast((message) => message.role === "user");
  const askedText =
    asked?.parts.map((part) => (part.type === "text" ? part.text : "")).join(" ") ?? "";
  const pastedUrl = URL_IN_TEXT.test(askedText);
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
      const [preferred, connectors, inProject, ownSkills, inBot, sourcesNeeded, plugins] =
        await Promise.all([
          preferences,
          Promise.race([connected, stopped]),
          project,
          userSkills,
          bot,
          forced === "search" ? needsSources(askedText) : true,
          owner !== undefined && !unattended
            ? listConnections(owner).catch(() => [])
            : Promise.resolve([]),
        ]);
      const opening = forced === "search" && !sourcesNeeded ? undefined : forced;
      const texts = inProject !== undefined;
      const settings = texts
        ? ({ ...preferred, answerLength: "short" } satisfies Settings)
        : preferred;
      const visible = recentTurns(
        messages,
        historyLimit ?? (inBot ? BOT_HISTORY : messages.length),
      );
      const searchable = inBot && visible.length < messages.length ? inBot : undefined;
      const sandbox = sandboxFiles();
      const routines = automate && {
        ...automate,
        timezone: preferred.timezone || automate.timezone,
      };
      const available = {
        ...tools,
        ...stophyTools(sources.add),
        ...(routines && routineTools({ ...routines, projectId: inBot?.id })),
        ...(inBot && !unattended && botTools(inBot)),
        ...(inBot && { islamic_dates: islamicDates }),
        ...(owner !== undefined && !unattended && skillTools(owner)),
        ...(owner !== undefined &&
          !unattended &&
          pluginTools(owner, inBot ? `/bot/${inBot.id}` : `/c/${turn.sessionId}`)),
        ...(!unattended &&
          memoryTools(
            owner === undefined
              ? undefined
              : inBot
                ? { kind: "bot", ...inBot }
                : { kind: "account", owner },
            inBot !== undefined || preferred.saveMemory,
          )),
        ...(!unattended && (mode === "research" || inBot) && { [CLARIFYING]: clarifyingQuestions }),
        ...(searchable && chatSearchTools(searchable)),
        ...(owner !== undefined &&
          !unattended &&
          !inBot &&
          preferred.usePastChats &&
          pastChatTools(owner, turn.sessionId)),
        ...(inBot && studyTools(inBot)),
        ...(!inBot && fileOwner !== undefined && codeTools(modelName)),
        ...(!inBot &&
          fileOwner !== undefined &&
          fileTools({
            owner: fileOwner,
            incognito: owner === undefined,
            research: mode === "research",
            sandbox: noorModel(modelName) !== undefined ? sandbox : undefined,
            link: sources.link,
          })),
        ...connectors.tools,
      };
      const builtIn = skillsFor({
        mode,
        texting: texts,
        inBot: inBot !== undefined,
        timezone: routines?.timezone,
        canWriteSkills: owner !== undefined && !unattended,
        userSkills: ownSkills,
        offered: available,
        plugins: connectors.tools,
      });
      const offered = {
        ...available,
        ...(builtIn.length > 0 && { [LOAD_SKILL]: loadSkill(builtIn) }),
      };
      const loaded = [
        ...loadedNames(
          messages.flatMap((message) =>
            message.parts
              .filter(isToolUIPart)
              .map((part) => ({ toolName: getToolName(part), input: part.input })),
          ),
        ),
        ...(mode === "research" ? RESEARCH_OPENS : []),
        ...openedBy(askedText, plugins),
      ];
      const writes = unattended ? [] : writingTools(connectors.tools);
      const agent = answerAgent({
        model: models.model,
        tools: offered,
        settings,
        instructions: instructions({
          now: new Date(),
          timezone: routines?.timezone,
          mode,
          settings,
          project: inProject,
          unattended: unattended === true,
          offered,
          skills: builtIn,
          remembers:
            owner !== undefined && !unattended && (inBot !== undefined || preferred.saveMemory),
          connectedApps: plugins.flatMap((plugin) => (plugin.connected ? [plugin.name] : [])),
          toolNotes: [searchable ? SEARCH_OUR_CHAT : ""],
        }),
        mentioned: skillRules(ownSkills, askedText),
        firstStep:
          opening && !inBot
            ? opening === "fetch" && noorModel(modelName) && !STOPHY_LINK.test(askedText)
              ? "fetch"
              : "anyTool"
            : undefined,
        skills: builtIn,
        loaded,
        confirm: (call) => needsApproval(call, new Set(writes)),
        shorten,
        turn,
      });
      const answer = await createAgentUIStream({
        agent,
        uiMessages: [
          ...(inBot ? await summaryNote(inBot) : []),
          ...(await readFiles(visible.map(withBareCitations), fileOwner)),
        ],
        originalMessages: messages,
        abortSignal,
        experimental_transform: [
          sources.transform(),
          sandbox.transform(),
          smoothStream({ chunking: "word" }),
        ],
        onEnd: ({ outcome, finishReason }) => {
          ended = { outcome, finishReason };
        },
        messageMetadata: ({ part }) => {
          if (part.type === "finish") usage = part.totalUsage;
          if (part.type === "finish-step")
            counted += countedTokens(part.usage, part.providerMetadata);
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
      const status = ended?.outcome.status ?? outcome.status;
      spend?.(counted);
      const totalMs = since();
      void Promise.resolve(bot).then((inBot) =>
        record({
          name: "answer.completed",
          props: {
            mode,
            model: modelName,
            outcome: status,
            finishReason: ended?.finishReason,
            httpStatus,
            totalMs,
            firstTextMs,
            toolCalls: calls.size,
            failedTools,
            cited: new Set(text.match(/\[\d+\]/g)).size,
            words: text.split(/\s+/).filter(Boolean).length,
            inputTokens: usage?.inputTokens,
            cachedInputTokens: usage?.inputTokenDetails.cacheReadTokens,
            cacheWriteTokens: usage?.inputTokenDetails.cacheWriteTokens,
            outputTokens: usage?.outputTokens,
            reasoningTokens: usage?.outputTokenDetails.reasoningTokens,
            from: unattended ? "routine" : inBot ? "bot" : "chat",
          },
        }),
      );
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
