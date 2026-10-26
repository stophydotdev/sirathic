import { db } from "@sirathic/db";
import { chatSessions, projects } from "@sirathic/db/schema";
import { type AnyColumn, and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { projectRemembered } from "./projectRules";
import { StatusError } from "./respond";
import { updateSettings } from "./settings";
import { PROJECT_ICONS, PROJECT_NAME_MAX, containsLink } from "./shared/projects";
import { MEMORY_CHARS, MEMORY_LIMIT, type told } from "./shared/settings";

const MAX_PROJECTS = 50;

export const projectId = z.uuid();

const name = z
  .string()
  .trim()
  .min(1)
  .max(PROJECT_NAME_MAX)
  .refine((text) => !containsLink(text), "A project name cannot contain a link.");
const instructions = z.string().trim().max(4000);

export const projectInput = z.object({
  name,
  instructions: instructions.default(""),
  projectOnlyMemory: z.boolean().default(false),
});

export const projectUpdate = z
  .object({
    name: name.optional(),
    icon: z.enum(PROJECT_ICONS).nullable().optional(),
    instructions: instructions.optional(),
    projectOnlyMemory: z.boolean().optional(),
    memory: z.array(z.string().trim().min(1).max(MEMORY_CHARS)).max(MEMORY_LIMIT).optional(),
  })
  .refine(
    (update) => Object.values(update).some((value) => value !== undefined),
    "send a name, icon, instructions, memory choice or remembered facts",
  );

const millis = (column: AnyColumn) => sql<number>`(extract(epoch from ${column}) * 1000)::float8`;

const projectColumns = {
  id: projects.id,
  name: projects.name,
  icon: projects.icon,
  instructions: projects.instructions,
  projectOnlyMemory: projects.projectOnlyMemory,
  memory: projects.memory,
  createdAt: millis(projects.createdAt),
  updatedAt: millis(projects.updatedAt),
};

const owned = (id: string, by: string) => and(eq(projects.id, id), eq(projects.owner, by));

export const listProjects = (by: string) =>
  db
    .select(projectColumns)
    .from(projects)
    .where(eq(projects.owner, by))
    .orderBy(sql`lower(${projects.name})`);

export async function createProject(by: string, input: z.output<typeof projectInput>) {
  const [{ total }] = await db
    .select({ total: count() })
    .from(projects)
    .where(eq(projects.owner, by));
  if (total >= MAX_PROJECTS) {
    throw new StatusError(400, `You can have at most ${MAX_PROJECTS} projects.`);
  }
  const [created] = await db
    .insert(projects)
    .values({ owner: by, ...input })
    .returning(projectColumns);
  return created;
}

export async function updateProject(
  id: string,
  by: string,
  update: z.output<typeof projectUpdate>,
) {
  const [row] = await db
    .update(projects)
    .set(update)
    .where(owned(id, by))
    .returning(projectColumns);
  if (!row) throw new StatusError(404, "no such project");
  return row;
}

export async function removeProject(id: string, by: string) {
  const [row] = await db.delete(projects).where(owned(id, by)).returning({ id: projects.id });
  if (!row) throw new StatusError(404, "no such project");
  return { deleted: true };
}

export async function requireProject(id: string, by: string) {
  const [row] = await db.select({ id: projects.id }).from(projects).where(owned(id, by));
  if (!row) throw new StatusError(404, "no such project");
}

export async function projectOfChat(chatId: string, by: string, requested: string | undefined) {
  const [existing] = await db
    .select({ projectId: chatSessions.projectId })
    .from(chatSessions)
    .where(and(eq(chatSessions.id, chatId), eq(chatSessions.owner, by)));
  const id = existing ? existing.projectId : requested;
  if (!id) return undefined;
  const [project] = await db.select(projectColumns).from(projects).where(owned(id, by));
  return project;
}

export async function rememberInProject(id: string, by: string, input: z.output<typeof told>) {
  const [row] = await db.select({ memory: projects.memory }).from(projects).where(owned(id, by));
  if (!row) throw new StatusError(404, "no such project");
  const { memory, preferences } = projectRemembered(row.memory, input);
  await Promise.all([
    memory && db.update(projects).set({ memory }).where(owned(id, by)),
    Object.keys(preferences).length > 0 && updateSettings(by, preferences),
  ]);
  return { ...preferences, ...(memory && { memory }) };
}
