import type { ChatMessage, Effort } from "../shared/messages";
import { rememberEndedTask } from "./taskHistory";
import type { BotScope } from "./tools";

const MAX_RUNNING = 4;
export const STEPS_SHOWN = 5;
const ENDED_KEPT = 8;

export type TaskEnd =
  | { kind: "done"; text: string }
  | { kind: "failed"; reason: string }
  | { kind: "cutOff" }
  | { kind: "stopped" };

export type Task = {
  id: string;
  title: string;
  startedAt: number;
  endedAt: number | undefined;
  end: TaskEnd | undefined;
  steps: string[];
  now: { tool: string; detail: string | undefined } | undefined;
  notes: string[];
  messages: ChatMessage[];
  retried: boolean;
  controller: AbortController;
  finished: Promise<void>;
};

export type TaskView = {
  id: string;
  botId: string;
  title: string;
  state: "running" | TaskEnd["kind"];
  now: Task["now"];
  startedAt: number;
  endedAt: number | undefined;
};

export type Style = {
  modelName: string;
  effort: Effort;
  timezone: string | undefined;
};

type Book = {
  bot: BotScope;
  tasks: Map<string, Task>;
  awaiting: Task[];
  delivering: Promise<void> | undefined;
  style: Style | undefined;
};

const books = new Map<string, Book>();
let closing = false;

const keyOf = ({ id, owner }: BotScope) => `${owner}:${id}`;

const bookOf = (bot: BotScope) => {
  const found = books.get(keyOf(bot));
  if (found) return found;
  const created: Book = {
    bot,
    tasks: new Map(),
    awaiting: [],
    delivering: undefined,
    style: undefined,
  };
  books.set(keyOf(bot), created);
  return created;
};

const runningIn = (book: Book) => [...book.tasks.values()].filter((task) => !task.end);

export const stateOf = (task: Task) => {
  switch (task.end?.kind) {
    case undefined:
      return "running";
    case "done":
      return "finished";
    case "failed":
      return "failed";
    case "cutOff":
      return "cut off by a restart";
    case "stopped":
      return "stopped";
  }
};

export const tasksOf = (bot: BotScope) => [...bookOf(bot).tasks.values()];

export const taskOf = (bot: BotScope, id: string) => bookOf(bot).tasks.get(id);

export const runningTasksOf = (owner: string) =>
  [...books.values()]
    .filter((book) => book.bot.owner === owner)
    .flatMap((book) => runningIn(book).map((task) => ({ botId: book.bot.id, task })));

export const hasTasks = (owner: string, id: string) => {
  const book = books.get(keyOf({ id, owner }));
  return book !== undefined && (runningIn(book).length > 0 || book.awaiting.length > 0);
};

export function addTask(
  bot: BotScope,
  {
    title,
    messages,
    style,
    finished,
  }: { title: string; messages: ChatMessage[]; style: Style; finished: Promise<void> },
) {
  const book = bookOf(bot);
  if (closing) {
    throw new Error(
      "The server is restarting, so no new task can start now. Tell the user, and offer to start it again in a minute.",
    );
  }
  if (runningIn(book).length >= MAX_RUNNING) {
    throw new Error(
      `${MAX_RUNNING} tasks are already running. Wait for one to finish, steer one with message_task, or stop one with stop_task before starting another.`,
    );
  }
  const task: Task = {
    id: crypto.randomUUID().slice(0, 6),
    title,
    startedAt: Date.now(),
    endedAt: undefined,
    end: undefined,
    steps: [],
    now: undefined,
    notes: [],
    messages,
    retried: false,
    controller: new AbortController(),
    finished,
  };
  book.tasks.set(task.id, task);
  book.style = style;
  return task;
}

export function endTask(bot: BotScope, task: Task, end: TaskEnd) {
  if (task.end) return false;
  const book = bookOf(bot);
  task.end = end;
  task.endedAt = Date.now();
  if (end.kind !== "stopped") book.awaiting.push(task);
  rememberEndedTask(bot.owner, {
    id: task.id,
    botId: bot.id,
    title: task.title,
    state: end.kind,
    startedAt: task.startedAt,
    endedAt: task.endedAt,
  });
  const ended = [...book.tasks.values()].filter(
    (other) => other.end && !book.awaiting.includes(other),
  );
  for (const old of ended.slice(0, Math.max(0, ended.length - ENDED_KEPT))) {
    book.tasks.delete(old.id);
  }
  return true;
}

export function stopTasks(bot: BotScope, id: string | undefined) {
  const found =
    id === undefined
      ? tasksOf(bot).filter((task) => !task.end)
      : [taskOf(bot, id)].flatMap((task) => task ?? []);
  const stopped: Task[] = [];
  const alreadyEnded: Task[] = [];
  for (const task of found) {
    if (endTask(bot, task, { kind: "stopped" })) {
      task.controller.abort();
      stopped.push(task);
    } else {
      alreadyEnded.push(task);
    }
  }
  return { stopped, alreadyEnded };
}

export function takeAwaiting(bot: BotScope) {
  return bookOf(bot).awaiting.splice(0);
}

export function putBack(bot: BotScope, tasks: Task[]) {
  bookOf(bot).awaiting.unshift(...tasks);
}

export const hasAwaiting = (bot: BotScope) => bookOf(bot).awaiting.length > 0;

export const styleOf = (bot: BotScope) => bookOf(bot).style;

export const deliveryOf = (bot: BotScope) => bookOf(bot).delivering;

export function setDelivery(bot: BotScope, delivery: Promise<void> | undefined) {
  bookOf(bot).delivering = delivery;
}

export function cutOffAll() {
  closing = true;
  const affected: BotScope[] = [];
  for (const book of books.values()) {
    const running = runningIn(book);
    if (running.length === 0) continue;
    for (const task of running) {
      endTask(book.bot, task, { kind: "cutOff" });
      task.controller.abort();
    }
    affected.push(book.bot);
  }
  return affected;
}
