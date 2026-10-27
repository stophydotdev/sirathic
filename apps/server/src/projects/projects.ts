import { db } from "@sirathic/db";
import { chatSessions, projects } from "@sirathic/db/schema";
import { type AnyColumn, and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { PROFILE_LIMIT, profileEntry } from "../bots/profile";
import { pluginId } from "../plugins/catalog";
import { ownerCache } from "../account/ownerCache";
import { StatusError } from "../http";
import {
  BOT_COLORS,
  BOT_ICONS,
  PROJECT_NAME_MAX,
  SECTION_NAME_MAX,
  containsLink,
} from "../shared/projects";
import { MEMORY_CHARS, MEMORY_LIMIT } from "../shared/settings";

const MAX_PROJECTS = 50;
const MAX_BOT_PLUGINS = 100;

export const projectId = z.uuid();

export const projectName = z
  .string()
  .trim()
  .min(1)
  .max(PROJECT_NAME_MAX)
  .refine((text) => !containsLink(text), "A project name cannot contain a link.");
export const projectInstructions = z.string().trim().max(4000);
export const botTitle = z.string().trim().max(PROJECT_NAME_MAX);

export const projectInput = z.object({
  name: projectName,
  instructions: projectInstructions.default(""),
  title: botTitle.default(""),
  color: z.enum(BOT_COLORS).optional(),
  symbol: z.enum(BOT_ICONS).optional(),
});

export const projectUpdate = z
  .object({
    name: projectName.optional(),
    color: z.enum(BOT_COLORS).optional(),
    symbol: z.enum(BOT_ICONS).nullable().optional(),
    title: botTitle.optional(),
    pinned: z.boolean().optional(),
    section: z.string().trim().min(1).max(SECTION_NAME_MAX).nullable().optional(),
    hidden: z.boolean().optional(),
    plugins: z.array(pluginId).max(MAX_BOT_PLUGINS).nullable().optional(),
    instructions: projectInstructions.optional(),
    memory: z.array(z.string().trim().min(1).max(MEMORY_CHARS)).max(MEMORY_LIMIT).optional(),
    profile: z.array(profileEntry).max(PROFILE_LIMIT).optional(),
  })
  .refine(
    (update) => Object.values(update).some((value) => value !== undefined),
    "send a name, instructions, remembered facts or a bot setting",
  );

const millis = (column: AnyColumn) => sql<number>`(extract(epoch from ${column}) * 1000)::float8`;

const projectColumns = {
  id: projects.id,
  name: projects.name,
  icon: projects.icon,
  instructions: projects.instructions,
  projectOnlyMemory: projects.projectOnlyMemory,
  memory: projects.memory,
  kind: projects.kind,
  color: projects.color,
  symbol: projects.symbol,
  plugins: projects.plugins,
  title: projects.title,
  pinned: projects.pinned,
  section: projects.section,
  hidden: projects.hidden,
  greeting: projects.greeting,
  question: projects.question,
  options: projects.options,
  profile: projects.profile,
  note: projects.note,
  createdAt: millis(projects.createdAt),
  updatedAt: millis(projects.updatedAt),
};

const owned = (id: string, by: string) => and(eq(projects.id, id), eq(projects.owner, by));

const ownedBots = (by: string) => and(eq(projects.owner, by), eq(projects.kind, "bot"));

const loadBot = async (id: string, by: string) => {
  const [project] = await db
    .select(projectColumns)
    .from(projects)
    .where(and(owned(id, by), eq(projects.kind, "bot")));
  return project;
};

const bots = ownerCache<Awaited<ReturnType<typeof loadBot>>>();

const botKey = (id: string, by: string) => `${by}:${id}`;

export const forgetBot = (id: string, by: string) => bots.clear(botKey(id, by));

export const listProjects = (by: string) =>
  db
    .select(projectColumns)
    .from(projects)
    .where(ownedBots(by))
    .orderBy(sql`lower(${projects.name})`);

export async function createProject(by: string, input: z.output<typeof projectInput>) {
  const [{ total }] = await db.select({ total: count() }).from(projects).where(ownedBots(by));
  if (total >= MAX_PROJECTS) {
    throw new StatusError(400, `You can have at most ${MAX_PROJECTS} projects.`);
  }
  const [created] = await db
    .insert(projects)
    .values({
      owner: by,
      ...input,
      kind: "bot",
      projectOnlyMemory: true,
      color: input.color ?? BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)],
    })
    .returning(projectColumns);
  return created;
}

export async function saveOpener(
  id: string,
  by: string,
  opener: Required<Pick<typeof projects.$inferInsert, "greeting" | "question" | "options">>,
) {
  const [row] = await db
    .update(projects)
    .set(opener)
    .where(owned(id, by))
    .returning(projectColumns);
  forgetBot(id, by);
  if (!row) throw new StatusError(404, "no such project");
  return row;
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
  forgetBot(id, by);
  if (!row) throw new StatusError(404, "no such project");
  return row;
}

export async function removeProject(id: string, by: string) {
  await requireProject(id, by);
  await db
    .delete(chatSessions)
    .where(and(eq(chatSessions.projectId, id), eq(chatSessions.owner, by)));
  await db.delete(projects).where(owned(id, by));
  forgetBot(id, by);
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
  return bots.get(botKey(id, by), () => loadBot(id, by));
}

export async function profileOf(id: string, by: string) {
  const [row] = await db.select({ profile: projects.profile }).from(projects).where(owned(id, by));
  if (!row) throw new StatusError(404, "no such project");
  return row.profile;
}

export async function setProfile(id: string, by: string, facts: readonly string[]) {
  const known = new Map((await profileOf(id, by)).map((entry) => [entry.text, entry]));
  const profile = facts.map(
    (text) => known.get(text) ?? { text, source: "said" as const, at: Date.now() },
  );
  await db.update(projects).set({ profile }).where(owned(id, by));
  forgetBot(id, by);
}
