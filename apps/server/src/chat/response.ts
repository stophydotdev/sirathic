import {
  APICallError,
  consumeStream,
  createAgentUIStream,
  createIdGenerator,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type FinishReason,
  type InferUIMessageChunk,
  type LanguageModel,
  type LanguageModelUsage,
  smoothStream,
  type UIMessageStreamOutcome,
} from "ai";
import { z } from "zod";
import { memoryTools, rememberAfterAnswer } from "../account/memory";
import { pastChatTools } from "./pastChats";
import { noorModel } from "../models/noor";
import { countedTokens } from "../models/usage";
import type { RulesProject } from "../projects/rules";
import type { connectedTools } from "../plugins/connections";
import { type Event, toolFailure } from "./events";
import { type AutomationScope, routineTools } from "../automations/tools";
import { BOT_HISTORY, type BotScope, botTools, recentTurns } from "../bots/tools";
import { browserFor } from "../bots/browser";
import type { Room } from "../bots/room";
import { readingOnly, taskTools } from "../bots/taskTools";
import { type Summon, teamTools, teammatesOf } from "../bots/team";
import { summaryNote } from "../bots/summary";
import { chatSearchTools, SEARCH_OUR_CHAT } from "../bots/chatSearch";
import { studyTools } from "../bots/studyTools";
import { islamicDates } from "../bots/islamicDates";
import { prayerTimes } from "../prayer/tool";
import { settingTools } from "../account/settingTools";
import { citations, withBareCitations } from "./citations";
import { codeSandbox } from "./codeTools";
import { needsCard } from "./autoReview";
import { withDeclineReasons, withoutOriginalInputs, writingTools } from "./confirm";
import { needsSources } from "./relevance";
import { listConnections } from "../plugins/connections";
import { fileTools } from "./fileTools";
import { botDisk, keepAttachments } from "../bots/disk";
import { imageTools } from "./images";
import { keepAlive } from "./keepAlive";
import { readFiles } from "../files/attachments";
import { reasonOf } from "../http";
import { skillRules } from "../skills/skills";
import { pluginTools } from "../plugins/tools";
import { skillTools } from "../skills/tools";
import type { ChatMessage, Mode } from "../shared/messages";
import type { Settings } from "../shared/settings";
import { shortenEarlierResults, withReactionNotes, withSenderNote } from "./history";
import { instructions, userFacts } from "./prompts/build";
import {
  loadedEarlier,
  loadSkill,
  LOAD_SKILL,
  openedBy,
  RESEARCH_OPENS,
  type UserSkill,
  skillsFor,
} from "./skills/builtIn";
import { STOPHY_LINK, stophyTools } from "./stophyTools";
import { answerAgent, type Turn } from "./answerAgent";
import { answerFromResults } from "./answerFromResults";
import { answerOptions } from "../models/subscription";
import { answerCards, placeBook, todoBook } from "./cards";
import { afterAnswer } from "./afterAnswer";
import type { SourceKind } from "../shared/sources";
import { xSearchTools } from "./xSearch";
import { hasGrok } from "../models/plans";
import {
  CLARIFYING,
  botQuestions,
  clarifyingQuestions,
  SEND_FEEDBACK,
  sendFeedback,
  sirathicTools,
} from "./tools";

export const KEEPALIVE_MS = 15_000;
const FALLBACK_MS = 120_000;
const withText = z.object({ text: z.string() });
const connectCard = z.object({ status: z.literal("redirect") });
const URL_IN_TEXT = /https?:\/\/\S+/iu;

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
  consumeSseStream = consumeStream,
  spend,
  unattended,
  task,
  wake,
  steer,
  bot,
  historyLimit,
  citedEarlier,
  sourceKinds,
  summon,
  room,
  byBot,
}: {
  models: { model: Parameters<typeof answerAgent>[0]["model"]; small: LanguageModel };
  turn: Turn;
  modelName: string;
  messages: ChatMessage[];
  mode: Mode;
  abortSignal: AbortSignal;
  preferences: Promise<Settings>;
  connected: ReturnType<typeof connectedTools>;
  project: Promise<RulesProject | undefined>;
  userSkills: Promise<UserSkill[]>;
  title: ((sourcesNeeded: Promise<boolean>) => Promise<string | undefined>) | undefined;
  save: (messages: ChatMessage[]) => Promise<void>;
  record: (event: Event) => void;
  owner: string | undefined;
  automate: AutomationScope | undefined;
  fileOwner?: string;
  consumeSseStream?: Parameters<typeof createUIMessageStreamResponse>[0]["consumeSseStream"];
  spend?: (counted: number) => void;
  unattended?: true;
  task?: true;
  wake?: true;
  steer?: () => string[];
  bot?: Promise<BotScope | undefined>;
  historyLimit?: number;
  citedEarlier?: ChatMessage[];
  sourceKinds?: SourceKind[];
  summon?: Summon;
  room?: Room;
  byBot?: true;
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
  let browser: ReturnType<typeof browserFor> | undefined;
  const handsOn = !unattended && !wake;
  const sources = citations([...(citedEarlier ?? []), ...messages]);
  const shorten = shortenEarlierResults(messages);
  const tools = sirathicTools(sources.add, sourceKinds);
  const places = placeBook(messages);
  const todos = todoBook(messages);
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
  const lookup = forced === "search" ? needsSources(askedText) : Promise.resolve(true);
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
      void title?.(lookup).then((named) => {
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
      const [
        preferred,
        connectors,
        inProject,
        ownSkills,
        inBot,
        sourcesNeeded,
        plugins,
        grok,
        team,
      ] = await Promise.all([
        preferences,
        Promise.race([connected, stopped]),
        project,
        userSkills,
        bot,
        lookup,
        owner !== undefined && !unattended
          ? listConnections(owner).catch(() => [])
          : Promise.resolve([]),
        owner !== undefined && !unattended && hasGrok(owner).catch(() => false),
        Promise.resolve(bot).then((found) =>
          owner !== undefined && found && summon && !unattended
            ? teammatesOf(owner, found.id)
            : undefined,
        ),
      ]);
      const teammates = inBot ? team : undefined;
      const fromUser = room === undefined && !byBot;
      const cardsOk = !unattended && fromUser;
      const connectedHere = fromUser ? connectors.tools : readingOnly(connectors.tools);
      const opening = forced === "search" && !sourcesNeeded ? undefined : forced;
      const texts = inProject !== undefined;
      const visible = recentTurns(
        messages,
        historyLimit ?? (inBot ? BOT_HISTORY : messages.length),
      );
      browser = inBot && browserFor(inBot, unattended === true, byBot === true);
      const searchable =
        inBot && (unattended || visible.length < messages.length) ? inBot : undefined;
      const disk = inBot && botDisk(inBot.id);
      if (disk && fileOwner !== undefined) await keepAttachments(disk, asked, fileOwner);
      const sandbox = codeSandbox(
        inBot ? `bot:${inBot.id}` : `chat:${fileOwner}:${turn.sessionId}`,
        disk,
      );
      const routines = automate && {
        ...automate,
        timezone: preferred.timezone || automate.timezone,
      };
      const available = {
        ...tools,
        ...((!sourceKinds || sourceKinds.includes("web")) && {
          ...stophyTools(sources.add, places.add),
          ...imageTools(sources.addImage),
        }),
        ...(routines && !wake && routineTools({ ...routines, projectId: inBot?.id })),
        ...(inBot && handsOn && botTools(inBot)),
        ...(inBot && teammates && summon && teamTools(inBot, summon, room?.id, handsOn)),
        ...(inBot &&
          handsOn &&
          taskTools(inBot, { modelName, effort: turn.effort, timezone: routines?.timezone })),
        ...browser?.tools,
        islamic_dates: islamicDates,
        prayer_times: prayerTimes,
        ...(owner !== undefined && handsOn && settingTools(owner)),
        ...(owner !== undefined && handsOn && skillTools(owner)),
        ...(owner !== undefined && grok && xSearchTools(owner, sources.add)),
        ...(owner !== undefined && cardsOk && { [SEND_FEEDBACK]: sendFeedback }),
        ...(owner !== undefined &&
          cardsOk &&
          pluginTools(owner, inBot ? `/bot/${inBot.id}` : `/c/${turn.sessionId}`)),
        ...((!unattended || task) &&
          !byBot &&
          memoryTools(
            owner === undefined
              ? undefined
              : inBot
                ? { kind: "bot", ...inBot, saveShared: preferred.saveMemory }
                : { kind: "account", owner },
            handsOn && (inBot !== undefined || preferred.saveMemory),
          )),
        ...(cardsOk &&
          (mode === "research" || inBot) && {
            [CLARIFYING]: inBot ? botQuestions : clarifyingQuestions,
          }),
        ...(!unattended && answerCards(places, todos)),
        ...(searchable && chatSearchTools(searchable)),
        ...(owner !== undefined &&
          !unattended &&
          !inBot &&
          preferred.usePastChats &&
          pastChatTools(owner, turn.sessionId)),
        ...(inBot && studyTools(inBot)),
        ...(fileOwner !== undefined &&
          fileTools({
            owner: fileOwner,
            incognito: owner === undefined && !unattended,
            research: mode === "research",
            sandbox: noorModel(modelName) !== undefined ? sandbox : undefined,
            disk,
            link: sources.link,
          })),
        ...(task ? readingOnly(connectors.tools) : connectedHere),
      };
      const builtIn = skillsFor({
        mode,
        texting: texts,
        inBot: inBot !== undefined,
        timezone: routines?.timezone,
        canWriteSkills: owner !== undefined && handsOn,
        userSkills: ownSkills,
        offered: available,
        plugins: connectedHere,
      });
      const offered = {
        ...available,
        ...(builtIn.length > 0 && { [LOAD_SKILL]: loadSkill(builtIn) }),
      };
      const loaded = [
        ...loadedEarlier(messages),
        ...(mode === "research" ? RESEARCH_OPENS : []),
        ...openedBy(askedText, plugins),
      ];
      const writes = unattended ? [] : [...writingTools(connectors.tools), SEND_FEEDBACK];
      const system = instructions({
        now: new Date(),
        timezone: routines?.timezone,
        mode,
        settings: preferred,
        short: texts,
        project: inProject,
        unattended: unattended === true,
        task: task === true,
        offered,
        skills: builtIn,
        remembers: owner !== undefined && handsOn && (inBot !== undefined || preferred.saveMemory),
        connectedApps: plugins.flatMap((plugin) => (plugin.connected ? [plugin.name] : [])),
        toolNotes: [searchable ? SEARCH_OUR_CHAT : ""],
        teammates,
        room,
      });
      const agent = answerAgent({
        model: models.model,
        tools: offered,
        short: texts,
        instructions: system,
        mentioned: skillRules(ownSkills, askedText),
        firstStep:
          opening && (!inBot || unattended)
            ? opening === "fetch" && noorModel(modelName) && !STOPHY_LINK.test(askedText)
              ? "fetch"
              : "anyTool"
            : undefined,
        skills: builtIn,
        loaded,
        confirm: (call) => needsCard(call, new Set(writes), preferred.rules),
        refine: connectors.refine,
        shorten,
        turn,
        steer,
        quickly: mode === "quick" && !inBot && !unattended ? { asked: askedText } : undefined,
      });
      const answer = await createAgentUIStream({
        agent,
        uiMessages: [
          ...(inBot ? await summaryNote(inBot) : []),
          ...withDeclineReasons(
            withoutOriginalInputs(
              await readFiles(
                withReactionNotes(visible).map(withSenderNote).map(withBareCitations),
                fileOwner,
              ),
            ),
          ),
        ],
        originalMessages: messages,
        abortSignal,
        experimental_transform: [sources.transform(), smoothStream({ chunking: "word" })],
        onEnd: ({ outcome, finishReason }) => {
          ended = { outcome, finishReason };
        },
        messageMetadata: ({ part }) => {
          if (part.type === "finish-step") counted += countedTokens(part.usage);
          if (part.type !== "finish") return undefined;
          usage = part.totalUsage;
          const cited = sources.cited();
          return cited && { cited };
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
      let failure: InferUIMessageChunk<ChatMessage> | undefined;
      const results: string[] = [];
      let connecting = false;
      for await (const chunk of answer) {
        if (chunk.type === "start") continue;
        if (chunk.type === "finish") finish = chunk;
        else if (chunk.type === "error") failure = chunk;
        else writer.write(chunk);
        if (chunk.type === "tool-output-available") {
          results.push(withText.safeParse(chunk.output).data?.text ?? JSON.stringify(chunk.output));
          if (
            calls.get(chunk.toolCallId)?.tool === "install_plugin" &&
            connectCard.safeParse(chunk.output).success
          ) {
            connecting = true;
          }
        }
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
      const unanswered =
        !text.trim() &&
        ended?.finishReason !== "tool-calls" &&
        !connecting &&
        (!abortSignal.aborted || (unattended === true && !task)) &&
        results.length > 0;
      if (unanswered) {
        const fallback = await answerFromResults({
          model: models.model,
          system,
          asked: askedText,
          earlier: visible.slice(
            0,
            visible.findLastIndex((message) => message.role === "user"),
          ),
          results,
          writer,
          transform: sources.transform(),
          abortSignal: abortSignal.aborted ? AbortSignal.timeout(FALLBACK_MS) : abortSignal,
          providerOptions: answerOptions(turn),
        }).catch((err: Error) => {
          console.error(`answer from results failed: ${reasonOf(err)}`);
          return undefined;
        });
        text = fallback?.text ?? "";
        if (fallback) counted += countedTokens(fallback.usage);
      }
      if (failure && !(unanswered && text.trim())) writer.write(failure);
      const calledMemory = [...calls.values()].some(({ tool }) => tool === "update_memory");
      if (
        owner !== undefined &&
        !inBot &&
        !unattended &&
        preferred.saveMemory &&
        !calledMemory &&
        ended?.finishReason === "stop"
      ) {
        void rememberAfterAnswer({
          scope: { kind: "account", owner },
          messages,
          model: models.small,
          abortSignal,
        }).catch((err: Error) => {
          console.error(`memory not saved: ${reasonOf(err)}`);
        });
      }
      if (!unattended && ended?.finishReason === "stop" && text.trim()) {
        await afterAnswer({
          writer,
          model: models.small,
          asked: askedText,
          answer: text,
          related: !inBot && sourcesNeeded,
          research: !inBot && mode === "quick",
          facts: userFacts(preferred),
          abortSignal,
        });
      }
      streaming = false;
      if (finish) writer.write(finish);
    },
    onError: (error) => (error instanceof Error ? error.message : String(error)),
    onEnd: ({ messages: answered, outcome }) => {
      browser?.release();
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
            from: task ? "task" : unattended ? "routine" : inBot ? "bot" : "chat",
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
    consumeSseStream,
  });
  return new Response(response.body?.pipeThrough(keepAlive(KEEPALIVE_MS)) ?? null, response);
}
