import { db } from "@sirathic/db";
import { automations, chatSessions, projects, users } from "@sirathic/db/schema";
import { and, asc, eq, lte } from "drizzle-orm";
import { toUser } from "../auth";
import { answerOptions, sideOptions } from "../chatgpt/codex";
import { countNoorAnswer, pickModels } from "../chat/models";
import { BOT_HISTORY } from "../chat/botTools";
import { chatResponse } from "../chat/response";
import { connectedTools } from "../connectors/connections";
import { track } from "../events";
import { projectOfChat } from "../projects";
import { projectRules, settingsInProject } from "../projectRules";
import { reasonOf, StatusError } from "../respond";
import { openSession, saveSession } from "../sessions";
import { getSettings } from "../settings";
import { type ChatMessage, type Mode, mode as modeSchema } from "../shared/messages";
import { DEFAULT_SETTINGS } from "../shared/settings";
import { dueItems, progressOf } from "../study";
import type { User } from "../users";
import { nextRun, schedule } from "./schedule";

const TICK_MS = 60_000;
const BATCH = 5;
const RUN_TIMEOUT_MS = 10 * 60_000;

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

const lastPost = (earlier: ChatMessage[], routine: string) => {
  const asked = earlier.findLastIndex((message) => message.metadata?.routine === routine);
  return asked < 0 ? "" : textOf(earlier[asked + 1]).trim();
};

type Due = Awaited<ReturnType<typeof dueItems>>;

export const routineBrief = ({
  prompt,
  previous,
  due,
  studying,
}: {
  prompt: string;
  previous: string;
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
    previous && `Your last post for this routine was:\n${previous}\nDo not repeat it.`,
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
  sessionId: string,
  inProject: string | null,
  runMode: Mode,
) {
  const user = await ownerOf(by);
  const { modelName, models } = pickModels(user, undefined);
  await countNoorAnswer(by, modelName);
  const project = await projectOfChat(sessionId, by, inProject ?? undefined);
  let answered: ChatMessage[] = [];
  const response = chatResponse({
    models,
    modelName,
    messages: conversation,
    mode: runMode,
    abortSignal: AbortSignal.timeout(RUN_TIMEOUT_MS),
    preferences: getSettings(by)
      .then((settings) => settingsInProject(settings, project))
      .catch((err: Error) => {
        console.error(`settings not read: ${reasonOf(err)}`);
        return DEFAULT_SETTINGS;
      }),
    connected: connectedTools(by, project?.kind === "bot" ? project.plugins : undefined),
    projectRules: Promise.resolve(projectRules(project, false)),
    skillRules: Promise.resolve(""),
    options: {
      answer: answerOptions({ research: runMode === "research", sessionId }),
      side: sideOptions,
    },
    title: undefined,
    save: async (messages) => {
      answered = messages;
    },
    record: (event) => track(event, by),
    remember: undefined,
    automate: undefined,
    historyLimit: inProject ? BOT_HISTORY : undefined,
  });
  await response.arrayBuffer();
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
}: typeof automations.$inferSelect) {
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
              previous: lastPost(earlier, name),
              due,
              studying: progress !== undefined && progress.memorized + progress.learning > 0,
            }),
          },
        ],
      }
    : asked;
  const answered = await answerPrompt(
    owner,
    [...earlier, briefed],
    sessionId,
    projectId,
    runMode,
  ).catch((err: Error) => {
    console.error(`automation ${id} not answered: ${reasonOf(err)}`);
    return [
      ...earlier,
      asked,
      textMessage("assistant", `This run did not finish. ${reasonOf(err)}`, runMode),
    ];
  });
  const messages = answered.map((message) => (message.id === asked.id ? asked : message));
  if (bot && isSkip(textOf(messages.at(-1)))) {
    await db.update(automations).set({ lastRunAt: new Date() }).where(eq(automations.id, id));
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
      projectId,
    });
  }
  await db.update(automations).set({ lastRunAt: new Date() }).where(eq(automations.id, id));
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
  if (!claimed) return;
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
