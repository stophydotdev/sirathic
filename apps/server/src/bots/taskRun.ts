import { parseJsonEventStream, type UIMessageChunk, uiMessageChunkSchema } from "ai";
import { z } from "zod";
import { isSkip, lastWords, ownerOf } from "../automations/runner";
import { getSettings } from "../account/settings";
import { listSkills } from "../skills/skills";
import { connectedTools } from "../plugins/connections";
import { type Event, track } from "../chat/events";
import { holdShutdown, isAnswering, startAnswer, whenIdle } from "../chat/answers";
import { chatResponse } from "../chat/response";
import { openSession, saveSession, updateSession } from "../chat/sessions";
import { reasonOf, StatusError } from "../http";
import { pickModels } from "../models/pick";
import { sideOptions } from "../models/subscription";
import { spendNoor } from "../models/usage";
import { projectOfChat } from "../projects/projects";
import { type ChatMessage, messageText } from "../shared/messages";
import { DEFAULT_SETTINGS } from "../shared/settings";
import { refreshSummary } from "./summary";
import { answerIn, taskAnswer, waitingIn } from "./askUser";
import {
  addTask,
  changed,
  cutOffAll,
  deliveryOf,
  endTask,
  hasAwaiting,
  putBack,
  setDelivery,
  type Style,
  styleOf,
  stateOf,
  type Task,
  takeAwaiting,
  taskOf,
} from "./taskBook";
import { BOT_HISTORY, type BotScope } from "./tools";

const TASK_TIMEOUT_MS = 10 * 60_000;
const RESULT_CHARS = 12_000;
const STEP_CHARS = 100;
const STEPS_KEPT = 20;
const RESULT_LINE_CHARS = 120;
const SOURCES_KEPT = 10;
const stepInput = z.object({
  queries: z.array(z.string()).optional(),
  urls: z.array(z.string()).optional(),
  url: z.string().optional(),
});
const MARKDOWN = /[#*_`>]|^\s*[-\d.]+\s+|\[([^\]]*)\]\([^)]*\)/gmu;
const LINK = /https?:\/\/[^\s)>\]]+/gu;
const BARE_SOURCE = / ?\[\d+\](?:\(([^)\s]+)\))?/gu;

const messageOf = (
  role: ChatMessage["role"],
  text: string,
  metadata: ChatMessage["metadata"] = {},
): ChatMessage => ({
  id: crypto.randomUUID(),
  role,
  metadata: { createdAt: Date.now(), mode: "quick", ...metadata },
  parts: [{ type: "text", text }],
});

const plainSources = (text: string) =>
  text.replace(BARE_SOURCE, (_found, link: string | undefined) => (link ? ` (${link})` : ""));

const resultOf = (text: string) =>
  (text.split("\n").find((line) => line.trim()) ?? "")
    .replace(MARKDOWN, (_found, label: string | undefined) => label ?? "")
    .replace(LINK, "")
    .replace(/\s*\(\s*\)/gu, "")
    .trim()
    .slice(0, RESULT_LINE_CHARS);

const sourcesOf = (text: string) => [...new Set(text.match(LINK) ?? [])].slice(0, SOURCES_KEPT);

async function turnOf(bot: BotScope, style: Style) {
  const user = await ownerOf(bot.owner);
  const { modelName, models } = pickModels(user, style.modelName);
  const project = await projectOfChat(bot.id, bot.owner, bot.id);
  if (project?.kind !== "bot") throw new Error("this bot no longer exists");
  return {
    models,
    modelName,
    mode: "quick" as const,
    preferences: getSettings(bot.owner).catch((err: Error) => {
      console.error(`settings not read: ${reasonOf(err)}`);
      return DEFAULT_SETTINGS;
    }),
    connected: connectedTools(bot.owner, project.plugins),
    project: Promise.resolve(project),
    userSkills: listSkills(bot.owner).catch(() => []),
    turn: { effort: style.effort, sessionId: bot.id, by: bot.owner },
    title: undefined,
    record: (event: Event) => track(event, bot.owner),
    owner: bot.owner,
    fileOwner: bot.owner,
    bot: Promise.resolve(bot),
    spend: spendNoor(bot.owner, modelName),
    historyLimit: BOT_HISTORY,
  };
}

const stepOf = (name: string, input: string | undefined) =>
  `${name} ${input ?? ""}`.trim().slice(0, STEP_CHARS);

async function readStream(response: Response, onChunk: (chunk: UIMessageChunk) => void) {
  let failure: string | undefined;
  await parseJsonEventStream({
    stream: response.body ?? new ReadableStream(),
    schema: uiMessageChunkSchema,
  }).pipeTo(
    new WritableStream({
      write: (chunk) => {
        if (!chunk.success) return;
        if (chunk.value.type === "error") failure = chunk.value.errorText;
        onChunk(chunk.value);
      },
    }),
  );
  return failure;
}

async function runTask(parent: BotScope, task: Task, signal: AbortSignal) {
  let answered = task.messages;
  const response = chatResponse({
    ...(await turnOf(task.runner, task.style)),
    messages: task.messages,
    abortSignal: signal,
    unattended: true,
    task: true,
    steer: () => task.notes.splice(0),
    automate: undefined,
    save: async (messages) => {
      answered = messages;
    },
  });
  const failure = await readStream(response, (chunk) => {
    if (chunk.type !== "tool-input-available") return;
    const asked = stepInput.safeParse(chunk.input).data;
    const site = chunk.toolName.startsWith("browser_") && task.now?.tool.startsWith("browser_");
    task.now = {
      tool: chunk.toolName,
      detail:
        asked?.queries?.at(-1) ??
        asked?.urls?.at(0) ??
        asked?.url ??
        (site ? task.now?.detail : undefined),
    };
    task.steps = [...task.steps, stepOf(chunk.toolName, JSON.stringify(chunk.input))].slice(
      -STEPS_KEPT,
    );
    changed(parent, task);
  });
  task.messages = answered;
  if (failure !== undefined) throw new Error(failure);
  const last = answered.at(-1);
  const waiting = last?.role === "assistant" ? waitingIn(last) : undefined;
  if (waiting) return { kind: "waiting", waiting } as const;
  const text = last?.role === "assistant" ? plainSources(messageText(last)).trim() : "";
  if (!text) throw new Error("it gave no result");
  return { kind: "done", text: text.slice(0, RESULT_CHARS) } as const;
}

async function run(bot: BotScope, task: Task) {
  const signal = AbortSignal.any([task.controller.signal, AbortSignal.timeout(TASK_TIMEOUT_MS)]);
  const outcome = await runTask(bot, task, signal).catch((err: Error) => {
    console.error(`task ${task.id} did not finish: ${reasonOf(err)}`);
    return {
      kind: "failed",
      reason:
        signal.aborted && !task.controller.signal.aborted ? "it ran out of time" : reasonOf(err),
    } as const;
  });
  if (outcome.kind === "waiting") {
    task.waiting = outcome.waiting;
    changed(bot, task);
    return;
  }
  const end =
    outcome.kind === "done"
      ? { ...outcome, result: resultOf(outcome.text), sources: sourcesOf(outcome.text) }
      : outcome;
  if (endTask(bot, task, end)) deliver(bot);
}

export function launchTask({
  bot,
  runner,
  title,
  brief,
  resume,
  style,
}: {
  bot: BotScope;
  runner: BotScope;
  title: string;
  brief: string;
  resume: string | undefined;
  style: Style;
}) {
  const before = resume === undefined ? undefined : taskOf(bot, resume);
  if (resume !== undefined && !before) throw new Error("No task has that id, so it cannot resume.");
  if (before && !before.end) {
    throw new Error("That task is still running. Steer it with message_task instead.");
  }
  const { promise: finished, resolve } = Promise.withResolvers<void>();
  const task = addTask(bot, {
    title,
    brief,
    runner: before?.runner ?? runner,
    messages: [...(before?.messages ?? []), messageOf("user", brief)],
    style,
    finished,
  });
  void run(bot, task).finally(resolve);
  return task;
}

export function answerTask(bot: BotScope, id: string, answer: z.infer<typeof taskAnswer>) {
  const task = taskOf(bot, id);
  const waiting = task?.waiting;
  const last = task?.messages.at(-1);
  if (!task || !waiting || !last) throw new StatusError(409, "That task is not waiting for you.");
  if ((waiting.kind === "approval") !== (answer.kind === "approval")) {
    throw new StatusError(400, "That answer doesn't fit what the task asked.");
  }
  answerIn(last, waiting, answer);
  task.waiting = undefined;
  changed(bot, task);
  void run(bot, task);
}

const updateOf = (task: Task) => {
  const body =
    task.end?.kind === "done"
      ? task.end.text
      : task.end?.kind === "failed"
        ? `It did not finish: ${task.end.reason}.`
        : "The server restarted before it finished, so it has no result. Tell the user it stopped and offer to start it again.";
  return `<task_update id="${task.id}" title=${JSON.stringify(task.title)} state="${stateOf(task)}">\n${body}\n</task_update>`;
};

const WAKE_NOTE =
  "These are updates from background tasks you started. They are not a message from the user, so do not answer them as if the user wrote them. Work out what the user is still waiting for and tell them in your own voice, as if you had just finished it yourself. Never mention tasks, updates or ids. If a result is stale, a duplicate or not something they awaited, reply with exactly SKIP and nothing else.";

async function wake(bot: BotScope, finished: Task[]) {
  const style = styleOf(bot);
  const stored = await openSession(bot.id, bot.owner, false);
  if (!style || !stored) return "dropped";
  const base = await turnOf(bot, style);
  const text = `${WAKE_NOTE}\n\n${finished.map(updateOf).join("\n\n")}`;
  const messages = [...stored, messageOf("user", text, { wake: true })];
  if (isAnswering(bot.owner, bot.id)) return "busy";
  const answer = startAnswer(bot.owner, bot.id, { continuing: true });
  let answered = messages;
  const response = chatResponse({
    ...base,
    messages,
    wake: true,
    abortSignal: answer.signal,
    consumeSseStream: answer.consumeSseStream,
    automate:
      style.timezone === undefined ? undefined : { owner: bot.owner, timezone: style.timezone },
    save: async (saved) => {
      answered = saved;
    },
  });
  const failure = await readStream(response, () => undefined);
  if (answer.superseded()) return "superseded";
  if (answer.signal.aborted) return "dropped";
  if (failure !== undefined) return "failed";
  const last = answered.at(-1);
  if (last?.role !== "assistant" || !last.parts.some((part) => part.type !== "step-start"))
    return "dropped";
  if (isSkip(lastWords(last))) return "silent";
  await saveSession(bot.id, bot.owner, answered, bot.id);
  await updateSession(bot.id, bot.owner, { unread: true });
  void refreshSummary({
    bot,
    messages: answered,
    model: base.models.small,
    providerOptions: sideOptions,
  });
  return "delivered";
}

async function drain(bot: BotScope): Promise<void> {
  await whenIdle(bot.owner, bot.id);
  const finished = takeAwaiting(bot);
  if (finished.length === 0) return;
  const outcome = await wake(bot, finished).catch((err: Error) => {
    console.error(`bot not woken: ${reasonOf(err)}`);
    return "dropped";
  });
  if (outcome === "busy" || outcome === "superseded") putBack(bot, finished);
  if (outcome === "failed") {
    const first = finished.filter((task) => !task.retried);
    for (const task of first) task.retried = true;
    putBack(bot, first);
  }
  return drain(bot);
}

function deliver(bot: BotScope) {
  if (deliveryOf(bot)) return;
  const work = holdShutdown(drain(bot)).finally(() => {
    setDelivery(bot, undefined);
    if (hasAwaiting(bot)) deliver(bot);
  });
  setDelivery(bot, work);
}

export function cutOffTasks() {
  for (const bot of cutOffAll()) deliver(bot);
}
