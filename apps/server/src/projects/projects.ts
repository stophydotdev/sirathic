import { db } from "@sirathic/db";
import { chatSessions, projects } from "@sirathic/db/schema";
import { type AnyColumn, and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  PROFILE_CHARS,
  PROFILE_LIMIT,
  type ProfileEntry,
  profileEntry,
  profileRejection,
  withEntry,
} from "../bots/profile";
import { pluginId } from "../plugins/catalog";
import { projectRemembered } from "./rules";
import { StatusError } from "../http";
import { remember, updateSettings } from "../account/settings";
import {
  BOT_COLORS,
  BOT_ICONS,
  PROJECT_ICONS,
  PROJECT_NAME_MAX,
  SECTION_NAME_MAX,
  containsLink,
} from "../shared/projects";
import { MEMORY_CHARS, MEMORY_LIMIT, type told } from "../shared/settings";

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
  projectOnlyMemory: z.boolean().default(false),
  kind: z.enum(["project", "bot"]).default("project"),
  title: botTitle.default(""),
  color: z.enum(BOT_COLORS).optional(),
  symbol: z.enum(BOT_ICONS).optional(),
});

export const projectUpdate = z
  .object({
    name: projectName.optional(),
    icon: z.enum(PROJECT_ICONS).nullable().optional(),
    color: z.enum(BOT_COLORS).optional(),
    symbol: z.enum(BOT_ICONS).nullable().optional(),
    title: botTitle.optional(),
    pinned: z.boolean().optional(),
    section: z.string().trim().min(1).max(SECTION_NAME_MAX).nullable().optional(),
    hidden: z.boolean().optional(),
    plugins: z.array(pluginId).max(MAX_BOT_PLUGINS).nullable().optional(),
    instructions: projectInstructions.optional(),
    projectOnlyMemory: z.boolean().optional(),
    memory: z.array(z.string().trim().min(1).max(MEMORY_CHARS)).max(MEMORY_LIMIT).optional(),
    profile: z.array(profileEntry).max(PROFILE_LIMIT).optional(),
  })
  .refine(
    (update) => Object.values(update).some((value) => value !== undefined),
    "send a name, icon, instructions, memory choice, remembered facts or a bot setting",
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
  const bot = input.kind === "bot" && {
    projectOnlyMemory: true,
    color: input.color ?? BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)],
  };
  const [created] = await db
    .insert(projects)
    .values({ owner: by, ...input, ...bot })
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

export async function addProfileEntry(
  id: string,
  by: string,
  entry: ProfileEntry,
  replaces: string | null,
) {
  const [row] = await db.select({ profile: projects.profile }).from(projects).where(owned(id, by));
  if (!row) throw new StatusError(404, "no such project");
  const profile = withEntry(row.profile, entry, replaces);
  if (!profile) return { kind: "full", profile: row.profile } as const;
  await db.update(projects).set({ profile }).where(owned(id, by));
  return { kind: "saved", profile } as const;
}

export async function rememberInBot(
  id: string,
  by: string,
  { fact, replaces, ...preferences }: z.output<typeof told>,
) {
  const kept = fact?.trim().slice(0, PROFILE_CHARS);
  const entry = kept && !profileRejection(kept) ? kept : undefined;
  const saved = await remember(by, { ...preferences, fact: null, replaces: null });
  if (!entry) return saved;
  const added = await addProfileEntry(
    id,
    by,
    { text: entry, source: "said", at: Date.now() },
    replaces,
  );
  return added.kind === "full"
    ? { ...saved, memory: added.profile.map((old) => old.text) }
    : { ...saved, fact: entry };
}
