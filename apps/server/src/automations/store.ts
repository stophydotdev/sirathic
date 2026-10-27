import { db } from "@sirathic/db";
import { automations, chatSessions } from "@sirathic/db/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { projectId, requireProject } from "../projects/projects";
import { StatusError } from "../http";
import { mode } from "../shared/messages";
import { PROJECT_ICONS } from "../shared/projects";
import { nextRun, notify, schedule, timezone } from "./schedule";

const MAX_AUTOMATIONS = 10;
const RUNS_LIMIT = 50;

export const automationId = z.uuid();

const name = z.string().trim().min(1).max(60);
const prompt = z.string().trim().min(1).max(4000);

const icon = z.enum(PROJECT_ICONS).nullable();

const automationFields = z.object({
  name,
  prompt,
  icon: icon.optional(),
  mode: mode.optional(),
  notify: notify.optional(),
  schedule,
  timezone,
});

export const automationInput = automationFields.extend({ projectId: projectId.optional() });

export const automationUpdate = automationFields
  .partial()
  .extend({ enabled: z.boolean().optional() })
  .refine(
    (update) => Object.values(update).some((value) => value !== undefined),
    "send a name, prompt, icon, mode, notify, schedule, timezone or enabled",
  );

const owned = (id: string, by: string) => and(eq(automations.id, id), eq(automations.owner, by));

const present = (row: typeof automations.$inferSelect) => ({
  id: row.id,
  projectId: row.projectId,
  name: row.name,
  prompt: row.prompt,
  icon: icon.parse(row.icon),
  mode: mode.parse(row.mode),
  notify: notify.parse(row.notify),
  schedule: schedule.parse(row.schedule),
  timezone: row.timezone,
  enabled: row.enabled,
  nextRunAt: row.nextRunAt?.toISOString() ?? null,
  lastRunAt: row.lastRunAt?.toISOString() ?? null,
});

const upcoming = (plan: z.output<typeof schedule>, zone: string) => {
  const next = nextRun(plan, zone, new Date());
  if (!next) throw new StatusError(400, "That time has already passed.");
  return next;
};

export async function listAutomations(by: string) {
  const rows = await db
    .select()
    .from(automations)
    .where(eq(automations.owner, by))
    .orderBy(sql`lower(${automations.name})`);
  return rows.map(present);
}

export async function createAutomation(by: string, input: z.output<typeof automationInput>) {
  const [{ total }] = await db
    .select({ total: count() })
    .from(automations)
    .where(eq(automations.owner, by));
  if (total >= MAX_AUTOMATIONS) {
    throw new StatusError(400, `You can have at most ${MAX_AUTOMATIONS} automations.`);
  }
  if (input.projectId) await requireProject(input.projectId, by);
  const [created] = await db
    .insert(automations)
    .values({ owner: by, ...input, nextRunAt: upcoming(input.schedule, input.timezone) })
    .returning();
  return present(created);
}

export async function updateAutomation(
  id: string,
  by: string,
  update: z.output<typeof automationUpdate>,
) {
  const [current] = await db.select().from(automations).where(owned(id, by));
  if (!current) throw new StatusError(404, "no such automation");
  const changed = {
    ...update,
    schedule: update.schedule ?? schedule.parse(current.schedule),
    timezone: update.timezone ?? current.timezone,
    enabled: update.enabled ?? (update.schedule ? true : current.enabled),
  };
  const [row] = await db
    .update(automations)
    .set({
      ...changed,
      ...(changed.enabled && { failures: 0 }),
      nextRunAt: changed.enabled ? upcoming(changed.schedule, changed.timezone) : null,
    })
    .where(owned(id, by))
    .returning();
  return present(row);
}

export async function removeAutomation(id: string, by: string) {
  const [row] = await db.delete(automations).where(owned(id, by)).returning({ id: automations.id });
  if (!row) throw new StatusError(404, "no such automation");
  return { deleted: true };
}

export const listRuns = (by: string) =>
  db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      unread: chatSessions.unread,
      automationId: chatSessions.automationId,
      notify: automations.notify,
      createdAt: sql<string>`to_char(${chatSessions.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
    })
    .from(chatSessions)
    .innerJoin(automations, eq(automations.id, chatSessions.automationId))
    .where(eq(chatSessions.owner, by))
    .orderBy(desc(chatSessions.createdAt))
    .limit(RUNS_LIMIT);
