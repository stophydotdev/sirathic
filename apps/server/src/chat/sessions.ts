import { db } from "@sirathic/db";
import { chatSessions } from "@sirathic/db/schema";
import { validateUIMessages } from "ai";
import { type AnyColumn, and, desc, eq, gt, ilike, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { type ChatMessage, chatData, feedback, messageMetadata, report } from "../shared/messages";
import { StatusError } from "../http";
import { isAnswering } from "./answers";

const TITLE_CHARS = 80;
const PREVIEW_CHARS = 90;
const RECENT_LIMIT = 50;
const LIKE_SPECIAL = /[\\%_]/gu;
const ASK_CHARS = 140;
const ASKS_PER_CHAT = 3;

export const sessionId = z.uuid();

export const sessionUpdate = z
  .object({
    title: z.string().trim().min(1).max(TITLE_CHARS).optional(),
    pinned: z.boolean().optional(),
    unread: z.boolean().optional(),
  })
  .refine(
    (update) => Object.values(update).some((value) => value !== undefined),
    "send a title, pinned or unread",
  );

export const feedbackInput = z.object({
  messageId: z.string().min(1),
  value: feedback.nullable(),
  report: report.optional(),
});

export const forkInput = z.object({ messageId: z.string().min(1) });

const keepUpdatedAt = sql`${chatSessions.updatedAt}`;

const isoTime = (column: AnyColumn) =>
  sql<string>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

const titleOf = (messages: ChatMessage[]) =>
  messages
    .find((message) => message.role === "user")
    ?.parts.map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim()
    .slice(0, TITLE_CHARS) || "Untitled";

export const messageSchemas = {
  dataSchemas: chatData,
  metadataSchema: messageMetadata,
};

const owned = (id: string, by: string) => and(eq(chatSessions.id, id), eq(chatSessions.owner, by));

const asked = z.array(z.string());

export const recentAsks = async (by: string, since: Date, chats: number) => {
  const rows = await db
    .select({
      asks: sql`coalesce((select json_agg(left(part->>'text', ${ASK_CHARS})) from jsonb_array_elements(${chatSessions.messages}) as message, jsonb_array_elements(message->'parts') as part where message->>'role' = 'user' and part->>'type' = 'text'), '[]'::json)`,
    })
    .from(chatSessions)
    .where(and(eq(chatSessions.owner, by), gt(chatSessions.updatedAt, since)))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(chats);
  return rows.flatMap(({ asks }) => asked.parse(asks).slice(-ASKS_PER_CHAT));
};

export const listSessions = async (by: string, query = "", limit = RECENT_LIMIT) => {
  const rows = await db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      pinned: chatSessions.pinned,
      unread: chatSessions.unread,
      projectId: chatSessions.projectId,
      updatedAt: isoTime(chatSessions.updatedAt),
      preview: sql<string>`left(coalesce((select string_agg(part->>'text', ' ') from jsonb_array_elements(${chatSessions.messages} -> -1 -> 'parts') as part where part->>'type' = 'text'), ''), ${PREVIEW_CHARS})`,
    })
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.owner, by),
        query
          ? ilike(
              chatSessions.title,
              `%${query.replaceAll(LIKE_SPECIAL, (special) => `\\${special}`)}%`,
            )
          : undefined,
      ),
    )
    .orderBy(desc(chatSessions.pinned), desc(chatSessions.updatedAt))
    .limit(limit);
  return rows.map((row) => Object.assign(row, { working: isAnswering(by, row.id) }));
};

async function storedMessages(id: string, by: string) {
  const [row] = await db
    .select({
      messages: chatSessions.messages,
      unread: chatSessions.unread,
      projectId: chatSessions.projectId,
    })
    .from(chatSessions)
    .where(owned(id, by));
  return row;
}

export async function openSession(id: string, by: string) {
  const row = await storedMessages(id, by);
  if (!row) return undefined;
  if (row.unread) {
    await db
      .update(chatSessions)
      .set({ unread: false, updatedAt: keepUpdatedAt })
      .where(owned(id, by));
  }
  return validateUIMessages<ChatMessage>({
    messages: row.messages,
    ...messageSchemas,
  });
}

export async function saveSession(
  id: string,
  by: string,
  messages: ChatMessage[],
  project?: string,
) {
  const [saved] = await db
    .insert(chatSessions)
    .values({ id, owner: by, title: titleOf(messages), messages, projectId: project })
    .onConflictDoUpdate({
      target: chatSessions.id,
      set: { messages, updatedAt: new Date() },
      setWhere: eq(chatSessions.owner, by),
    })
    .returning({ id: chatSessions.id });
  if (!saved) throw new StatusError(404, "no such session");
}

export async function titleSession(
  id: string,
  by: string,
  messages: ChatMessage[],
  generate: () => Promise<string | undefined>,
) {
  const placeholder = titleOf(messages);
  const [row] = await db
    .select({ title: chatSessions.title })
    .from(chatSessions)
    .where(owned(id, by));
  if (row?.title !== placeholder) return undefined;
  const title = (await generate())?.slice(0, TITLE_CHARS);
  if (!title || title === placeholder) return undefined;
  const [renamed] = await db
    .update(chatSessions)
    .set({ title, updatedAt: keepUpdatedAt })
    .where(and(owned(id, by), eq(chatSessions.title, placeholder)))
    .returning({ title: chatSessions.title });
  return renamed?.title;
}

export async function updateSession(
  id: string,
  by: string,
  update: z.output<typeof sessionUpdate>,
) {
  const [row] = await db
    .update(chatSessions)
    .set({ ...update, updatedAt: keepUpdatedAt })
    .where(owned(id, by))
    .returning({
      id: chatSessions.id,
      title: chatSessions.title,
      pinned: chatSessions.pinned,
      unread: chatSessions.unread,
    });
  if (!row) throw new StatusError(404, "no such session");
  return row;
}

export async function deleteSession(id: string, by: string) {
  const [row] = await db
    .delete(chatSessions)
    .where(owned(id, by))
    .returning({ id: chatSessions.id });
  if (!row) throw new StatusError(404, "no such session");
  return { deleted: true };
}

export async function messagesOf(id: string, by: string) {
  const row = await storedMessages(id, by);
  if (!row) throw new StatusError(404, "no such session");
  const messages = await validateUIMessages<ChatMessage>({
    messages: row.messages,
    ...messageSchemas,
  });
  return { messages, projectId: row.projectId };
}

export async function readSummary(id: string, by: string) {
  const [row] = await db
    .select({ summary: chatSessions.summary, summarized: chatSessions.summarized })
    .from(chatSessions)
    .where(owned(id, by));
  return row;
}

export const writeSummary = (id: string, by: string, summary: string, summarized: number) =>
  db
    .update(chatSessions)
    .set({ summary, summarized, updatedAt: keepUpdatedAt })
    .where(and(owned(id, by), lt(chatSessions.summarized, summarized)));

export async function setFeedback(
  id: string,
  by: string,
  { messageId, value, report: told }: z.output<typeof feedbackInput>,
) {
  const { messages } = await messagesOf(id, by);
  const target = messages.find((message) => message.id === messageId);
  if (!target) throw new StatusError(404, "no such message");
  const { feedback: _old, report: _oldReport, ...rest } = target.metadata ?? {};
  target.metadata = rest;
  if (value) target.metadata.feedback = value;
  if (value === "down" && told) target.metadata.report = told;
  await db.update(chatSessions).set({ messages, updatedAt: keepUpdatedAt }).where(owned(id, by));
  return { feedback: value };
}

export async function forkSession(
  id: string,
  by: string,
  { messageId }: z.output<typeof forkInput>,
) {
  const { messages, projectId: sourceProject } = await messagesOf(id, by);
  const end = messages.findIndex((message) => message.id === messageId);
  if (end === -1) throw new StatusError(404, "no such message");
  const copied = messages.slice(0, end + 1);
  const forked = crypto.randomUUID();
  await db.insert(chatSessions).values({
    id: forked,
    owner: by,
    title: titleOf(copied),
    messages: copied,
    projectId: sourceProject,
  });
  return { id: forked };
}

export const exportSessions = (by: string) =>
  db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      createdAt: isoTime(chatSessions.createdAt),
      updatedAt: isoTime(chatSessions.updatedAt),
      messages: chatSessions.messages,
    })
    .from(chatSessions)
    .where(eq(chatSessions.owner, by))
    .orderBy(desc(chatSessions.updatedAt));

export async function deleteAllSessions(by: string) {
  const deleted = await db
    .delete(chatSessions)
    .where(eq(chatSessions.owner, by))
    .returning({ id: chatSessions.id });
  return { deleted: deleted.length };
}
