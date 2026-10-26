import { db } from "@sirathic/db";
import { automations, chatSessions, users } from "@sirathic/db/schema";
import { and, asc, eq, lte } from "drizzle-orm";
import { toUser } from "../auth";
import { answerOptions, sideOptions } from "../chatgpt/codex";
import { countNoorAnswer, pickModels } from "../chat/models";
import { chatResponse } from "../chat/response";
import { connectedTools } from "../connectors/connections";
import { track } from "../events";
import { projectOfChat } from "../projects";
import { projectRules, settingsInProject } from "../projectRules";
import { reasonOf, StatusError } from "../respond";
import { getSettings } from "../settings";
import { type ChatMessage, type Mode, mode as modeSchema } from "../shared/messages";
import { DEFAULT_SETTINGS } from "../shared/settings";
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

const textMessage = (role: ChatMessage["role"], text: string, mode: Mode): ChatMessage => ({
  id: crypto.randomUUID(),
  role,
  metadata: { createdAt: Date.now(), mode },
  parts: [{ type: "text", text }],
});

async function answerPrompt(
  by: string,
  asked: ChatMessage,
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
    messages: [asked],
    mode: runMode,
    abortSignal: AbortSignal.timeout(RUN_TIMEOUT_MS),
    preferences: getSettings(by)
      .then((settings) => settingsInProject(settings, project))
      .catch((err: Error) => {
        console.error(`settings not read: ${reasonOf(err)}`);
        return DEFAULT_SETTINGS;
      }),
    connected: connectedTools(by),
    projectRules: Promise.resolve(projectRules(project)),
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
  });
  await response.arrayBuffer();
  const reply = answered.findLast((message) => message.role === "assistant");
  const text = reply?.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
  if (!text?.trim()) throw new Error("the model gave no answer");
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
  const sessionId = crypto.randomUUID();
  const runMode = modeSchema.catch("quick").parse(mode);
  const asked = textMessage("user", prompt, runMode);
  const messages = await answerPrompt(owner, asked, sessionId, projectId, runMode).catch(
    (err: Error) => {
      console.error(`automation ${id} not answered: ${reasonOf(err)}`);
      return [
        asked,
        textMessage("assistant", `This run did not finish. ${reasonOf(err)}`, runMode),
      ];
    },
  );
  await db.insert(chatSessions).values({
    id: sessionId,
    owner,
    title: name,
    messages,
    unread: true,
    automationId: id,
    projectId,
  });
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
