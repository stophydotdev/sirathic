import { db } from "@sirathic/db";
import { automations, chatSessions, projects, users } from "@sirathic/db/schema";
import { parseJsonEventStream, uiMessageChunkSchema } from "ai";
import { and, asc, eq, lte } from "drizzle-orm";
import { toUser } from "../account/auth";
import { pickModels } from "../models/pick";
import { BOT_HISTORY } from "../bots/tools";
import { chatResponse } from "../chat/response";
import { connectedTools } from "../plugins/connections";
import { track } from "../chat/events";
import { projectOfChat } from "../projects/projects";
import { settingsInProject } from "../projects/rules";
import { reasonOf, StatusError } from "../http";
import { openSession, saveSession } from "../chat/sessions";
import { getSettings } from "../account/settings";
import {
  type ChatMessage,
  DEFAULT_EFFORT,
  type Mode,
  mode as modeSchema,
} from "../shared/messages";
import { DEFAULT_SETTINGS } from "../shared/settings";
import { dueItems, progressOf } from "../bots/study";
import type { User } from "../account/users";
import { nextRun, schedule } from "./schedule";

const TICK_MS = 60_000;
const BATCH = 5;
const RUN_TIMEOUT_MS = 10 * 60_000;
const PAUSE_AFTER = 3;
const MISSED_AFTER_MS = 60 * 60_000;
const SIGN_IN_FAILURE = /^(401|403)\b|sign-in ended/u;

const failureNote = (failedInARow: number, reason: string) =>
  failedInARow >= PAUSE_AFTER
    ? `Paused after ${PAUSE_AFTER} failed runs in a row. Turn it back on in Automations.`
    : failedInARow === 1
      ? `This run did not finish. ${reason}`
      : undefined;

async function ownerOf(id: string): Promise<User> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      image: users.image,
      plan: users.plan,
      accountId: users.accountId,
    })
    .from(users)
    .where(eq(users.id, id));
  if (!row) throw new Error("owner not found");
  return toUser(row);
}

const textMessage = (
  role: ChatMessage["role"],
  text: string,
  mode: Mode,
  routine?: string,
): ChatMessage => ({
  id: crypto.randomUUID(),
  role,
  metadata: { createdAt: Date.now(), mode, routine },
  parts: [{ type: "text", text }],
});

const NUDGE_ONLY =
  "Do not quiz, teach or grade anything here. Post a short nudge that says what is due and invites them to start. If nothing is due and the job does not call for a new item today, reply with exactly SKIP and nothing else.";

const textOf = (message: ChatMessage | undefined) =>
  message?.role === "assistant"
    ? message.parts.map((part) => (part.type === "text" ? part.text : "")).join("")
    : "";

export const isSkip = (text: string) =>
  text
    .trim()
    .replace(/[.!]+$/u, "")
    .toUpperCase() === "SKIP";

const TOPICS_KEPT = 30;
const TOPIC_CHARS = 100;

const pastTopics = (earlier: ChatMessage[], routine: string) =>
  earlier
    .flatMap((message, index) =>
      message.metadata?.routine === routine
        ? [
            (
              textOf(earlier[index + 1])
                .trim()
                .split("\n")[0] ?? ""
            ).slice(0, TOPIC_CHARS),
          ]
        : [],
    )
    .filter(Boolean)
    .slice(-TOPICS_KEPT);

type Due = Awaited<ReturnType<typeof dueItems>>;

export const routineBrief = ({
  prompt,
  topics,
  due,
  studying,
}: {
  prompt: string;
  topics: string[];
  due: Due;
  studying: boolean;
}) => {
  const list = due
    .map(
      ({ label, step, mistake }) =>
        `${label} (step ${step}${mistake ? `, last mistake: ${mistake}` : ""})`,
    )
    .join("; ");
  const parts = [
    prompt,
    studying &&
      (due.length > 0 ? `Due for review now: ${list}.` : "Nothing is due for review now."),
    topics.length > 0 &&
      `Earlier posts for this routine, oldest first:\n${topics.map((topic) => `- ${topic}`).join("\n")}\nDo not repeat any of them.`,
    studying && NUDGE_ONLY,
  ];
  return parts.flatMap((part) => (part ? [part] : [])).join("\n\n");
};

async function botOf(projectId: string, owner: string) {
  const [bot] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.owner, owner), eq(projects.kind, "bot")));
  return bot;
}

async function answerPrompt(
  by: string,
  conversation: ChatMessage[],
  earlier: ChatMessage[],
  sessionId: string,
  inProject: string | null,
  runMode: Mode,
) {
  const user = await ownerOf(by);
  const { modelName, models } = pickModels(user, undefined);
  const project = await projectOfChat(sessionId, by, inProject ?? undefined);
  let answered: ChatMessage[] = [];
  const response = chatResponse({
    models,
    modelName,
    messages: conversation,
    mode: runMode,
    abortSignal: AbortSignal.timeout(RUN_TIMEOUT_MS),
    unattended: true,
    preferences: getSettings(by)
      .then((settings) => settingsInProject(settings, project))
      .catch((err: Error) => {
        console.error(`settings not read: ${reasonOf(err)}`);
        return DEFAULT_SETTINGS;
      }),
    connected: connectedTools(by, project?.kind === "bot" ? project.plugins : undefined),
    project: Promise.resolve(project),
    userSkills: Promise.resolve([]),
    turn: {
      effort: project?.kind === "bot" ? "high" : DEFAULT_EFFORT[runMode],
      sessionId,
      by,
    },
    title: undefined,
    save: async (messages) => {
      answered = messages;
    },
    record: (event) => track(event, by),
    owner: undefined,
    automate: undefined,
    historyLimit: inProject ? BOT_HISTORY : undefined,
    citedEarlier: earlier,
  });
  let failure: string | undefined;
  await parseJsonEventStream({
    stream: response.body ?? new ReadableStream(),
    schema: uiMessageChunkSchema,
  }).pipeTo(
    new WritableStream({
      write: (chunk) => {
        if (chunk.success && chunk.value.type === "error") failure = chunk.value.errorText;
      },
    }),
  );
  if (failure !== undefined) throw new Error(failure);
  if (!textOf(answered.at(-1)).trim()) throw new Error("the model gave no answer");
  return answered;
}

async function runAutomation({
  id,
  owner,
  name,
  prompt,
  projectId,
  mode,
  failures,
}: typeof automations.$inferSelect) {
  const startedAt = performance.now();
  const runMode = modeSchema.catch("quick").parse(mode);
  const bot = projectId ? await botOf(projectId, owner) : undefined;
  const sessionId = bot?.id ?? crypto.randomUUID();
  const earlier = bot ? ((await openSession(bot.id, owner)) ?? []) : [];
  const asked = textMessage("user", prompt, runMode, bot && name);
  const study = bot ? { id: bot.id, owner } : undefined;
  const [due, progress] = study
    ? await Promise.all([dueItems(study, 5), progressOf(study)])
    : [[], undefined];
  const briefed = bot
    ? {
        ...asked,
        parts: [
          {
            type: "text" as const,
            text: routineBrief({
              prompt,
              topics: pastTopics(earlier, name),
              due,
              studying: progress !== undefined && progress.memorized + progress.learning > 0,
            }),
          },
        ],
      }
    : asked;
  const outcome = await answerPrompt(
    owner,
    [briefed],
    earlier,
    sessionId,
    bot ? projectId : null,
    runMode,
  ).then(
    (answered) => ({ kind: "answered", answered }) as const,
    (err: Error) => {
      console.error(`automation ${id} not answered: ${reasonOf(err)}`);
      const reason = reasonOf(err);
      return { kind: SIGN_IN_FAILURE.test(reason) ? "signedOut" : "failed", reason } as const;
    },
  );
  const failedInARow =
    outcome.kind === "failed" ? failures + 1 : outcome.kind === "answered" ? 0 : failures;
  const note =
    outcome.kind === "answered"
      ? undefined
      : outcome.kind === "signedOut"
        ? `This run did not finish. ${outcome.reason}`
        : failureNote(failedInARow, outcome.reason);
  const answered =
    outcome.kind === "answered"
      ? outcome.answered
      : note === undefined
        ? undefined
        : [asked, textMessage("assistant", note, runMode)];
  const finished = {
    lastRunAt: new Date(),
    failures: failedInARow,
    ...(failedInARow >= PAUSE_AFTER && { enabled: false, nextRunAt: null }),
  };
  const messages = [
    ...earlier,
    ...(answered ?? []).map((message) => (message.id === asked.id ? asked : message)),
  ];
  const skipped = !answered || (bot && isSkip(textOf(messages.at(-1))));
  track(
    {
      name: "routine.ran",
      props: {
        outcome: skipped && outcome.kind === "answered" ? "skipped" : outcome.kind,
        ms: Math.round(performance.now() - startedAt),
      },
    },
    owner,
  );
  if (skipped) {
    await db.update(automations).set(finished).where(eq(automations.id, id));
    return;
  }
  if (bot) {
    await saveSession(bot.id, owner, messages, bot.id);
    await db
      .update(chatSessions)
      .set({ unread: true, automationId: id })
      .where(eq(chatSessions.id, bot.id));
  } else {
    await db.insert(chatSessions).values({
      id: sessionId,
      owner,
      title: name,
      messages,
      unread: true,
      automationId: id,
    });
  }
  await db.update(automations).set(finished).where(eq(automations.id, id));
}

export async function runNow(id: string, by: string) {
  const [found] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.owner, by)));
  if (!found) throw new StatusError(404, "no such automation");
  void runAutomation(found).catch((err: Error) => {
    console.error(`automation ${id} not run: ${reasonOf(err)}`);
  });
  return { started: true };
}

async function claimAndRun(due: typeof automations.$inferSelect) {
  if (!due.nextRunAt) return;
  const plan = schedule.safeParse(due.schedule);
  const next = plan.success ? nextRun(plan.data, due.timezone, new Date()) : undefined;
  const [claimed] = await db
    .update(automations)
    .set({ nextRunAt: next ?? null, enabled: next !== undefined })
    .where(and(eq(automations.id, due.id), eq(automations.nextRunAt, due.nextRunAt)))
    .returning({ id: automations.id });
  if (!claimed || Date.now() - due.nextRunAt.getTime() > MISSED_AFTER_MS) return;
  await runAutomation(due).catch((err: Error) => {
    console.error(`automation ${due.id} not run: ${reasonOf(err)}`);
  });
}

export async function runDue() {
  const due = await db
    .select()
    .from(automations)
    .where(and(eq(automations.enabled, true), lte(automations.nextRunAt, new Date())))
    .orderBy(asc(automations.nextRunAt))
    .limit(BATCH);
  await Promise.all(due.map(claimAndRun));
}

export function startScheduler() {
  let ticking = false;
  const tick = async () => {
    if (ticking) return;
    ticking = true;
    await runDue()
      .catch((err: Error) => {
        console.error(`automations not checked: ${reasonOf(err)}`);
      })
      .finally(() => {
        ticking = false;
      });
  };
  setInterval(tick, TICK_MS);
  void tick();
}
