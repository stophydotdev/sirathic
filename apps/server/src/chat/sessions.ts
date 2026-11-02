import { db } from "@sirathic/db";
import { chatSessions } from "@sirathic/db/schema";
import { validateUIMessages } from "ai";
import { type AnyColumn, and, desc, eq, gt, ilike, lt, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { type ChatMessage, chatData, feedback, messageMetadata, report } from "../shared/messages";
import { StatusError } from "../http";
import { hasTasks } from "../bots/taskBook";
import { isAnswering } from "./answers";

const TITLE_CHARS = 80;
const PREVIEW_CHARS = 90;
const SNIPPET_CHARS = 120;
const SNIPPET_LEAD_CHARS = 30;
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

export const keepUpdatedAt = sql`${chatSessions.updatedAt}`;

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

export const owned = (id: string, by: string) =>
  and(eq(chatSessions.id, id), eq(chatSessions.owner, by));

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

const hitIn = (query: string, pattern: string) =>
  sql<
    string | null
  >`(select substr(hit.text, greatest(position(lower(${query}) in lower(hit.text)) - ${SNIPPET_LEAD_CHARS}, 1), ${SNIPPET_CHARS} + length(${query})) from (select part->>'text' as text from jsonb_array_elements(${chatSessions.messages}) as message, jsonb_array_elements(message->'parts') as part where part->>'type' = 'text' and part->>'text' ilike ${pattern}) as hit limit 1)`;

export const listSessions = async (by: string, query = "", limit = RECENT_LIMIT) => {
  const pattern = `%${query.replaceAll(LIKE_SPECIAL, (special) => `\\${special}`)}%`;
  const hit = query ? hitIn(query, pattern) : sql<null>`null`;
  const rows = await db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      pinned: chatSessions.pinned,
      unread: chatSessions.unread,
      published: sql<boolean>`${chatSessions.publishedAt} is not null`,
      projectId: chatSessions.projectId,
      updatedAt: isoTime(chatSessions.updatedAt),
      snippet: hit,
      preview: sql<string>`left(regexp_replace(coalesce((select string_agg(part->>'text', ' ') from jsonb_array_elements(${chatSessions.messages} -> -1 -> 'parts') as part where part->>'type' = 'text'), ''), '^> [^\n]*\n\n', ''), ${PREVIEW_CHARS})`,
      waiting: sql<
        string | null
      >`(select left(coalesce(part->'input'->>'title', part->'input'->>'instruction'), ${PREVIEW_CHARS}) from jsonb_array_elements(${chatSessions.messages} -> -1 -> 'parts') as part where ${chatSessions.messages} -> -1 ->> 'role' = 'assistant' and part->>'type' in ('tool-request_user_form', 'tool-request_browser_help') limit 1)`,
    })
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.owner, by),
        query ? or(ilike(chatSessions.title, pattern), sql`${hit} is not null`) : undefined,
      ),
    )
    .orderBy(desc(chatSessions.pinned), desc(chatSessions.updatedAt))
    .limit(limit);
  return rows.map((row) =>
    Object.assign(row, { working: isAnswering(by, row.id) || hasTasks(by, row.id) }),
  );
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

export async function openSession(id: string, by: string, markRead = true) {
  const row = await storedMessages(id, by);
  if (!row) return undefined;
  if (markRead && row.unread) {
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

export const postedIn = (stored: readonly ChatMessage[]) => {
  const posted = new Set<string>();
  let inRoutine = false;
  for (const message of stored) {
    if (message.role === "user") inRoutine = message.metadata?.routine !== undefined;
    if (inRoutine || message.metadata?.from) posted.add(message.id);
  }
  return posted;
};

const withArrived = (stored: readonly ChatMessage[], sent: ChatMessage[]) => {
  const posted = postedIn(stored);
  return stored.reduce(
    (merged, message, index) => {
      if (!posted.has(message.id) || merged.some((kept) => kept.id === message.id)) return merged;
      const after = stored
        .slice(0, index)
        .findLast((earlier) => merged.some((kept) => kept.id === earlier.id));
      const next = after ? merged.findIndex((kept) => kept.id === after.id) + 1 : merged.length;
      const reply = merged[next];
      const answersAsked =
        merged[next - 1]?.role === "user" && reply?.role === "assistant" && !posted.has(reply.id);
      const at = answersAsked ? next + 1 : next;
      return [...merged.slice(0, at), message, ...merged.slice(at)];
    },
    [...sent],
  );
};

const withStoredMarks = (stored: readonly ChatMessage[], messages: ChatMessage[]) => {
  const saved = new Map(stored.map((message) => [message.id, message.metadata]));
  return messages.map((message) => {
    if (!saved.has(message.id)) return message;
    const marks = saved.get(message.id);
    return {
      ...message,
      metadata: {
        ...message.metadata,
        feedback: marks?.feedback,
        report: marks?.report,
        reaction: marks?.reaction,
      },
    };
  });
};

const SAVE_TRIES = 5;

export async function saveSession(
  id: string,
  by: string,
  messages: ChatMessage[],
  project?: string,
) {
  const title = titleOf(messages);
  const attempt = async (left: number): Promise<boolean> => {
    if (left === 0) return false;
    const [row] = await db
      .select({
        messages: chatSessions.messages,
        version: sql<string>`md5(${chatSessions.messages}::text)`,
      })
      .from(chatSessions)
      .where(owned(id, by));
    if (!row) {
      const [made] = await db
        .insert(chatSessions)
        .values({ id, owner: by, title, messages, projectId: project })
        .onConflictDoNothing()
        .returning({ id: chatSessions.id });
      return made !== undefined || attempt(left - 1);
    }
    const stored = await validateUIMessages<ChatMessage>({
      messages: row.messages,
      ...messageSchemas,
    }).catch(() => []);
    const [updated] = await db
      .update(chatSessions)
      .set({
        messages: withStoredMarks(stored, withArrived(stored, messages)),
        updatedAt: new Date(),
      })
      .where(and(owned(id, by), sql`md5(${chatSessions.messages}::text) = ${row.version}`))
      .returning({ id: chatSessions.id });
    return updated !== undefined || attempt(left - 1);
  };
  const saved = await attempt(SAVE_TRIES);
  if (!saved) throw new StatusError(404, "no such session");
}

export async function appendMessages(
  id: string,
  by: string,
  added: ChatMessage[],
  chat: { title: string; project: string },
) {
  const [saved] = await db
    .insert(chatSessions)
    .values({
      id,
      owner: by,
      title: chat.title,
      messages: added,
      projectId: chat.project,
      unread: true,
    })
    .onConflictDoUpdate({
      target: chatSessions.id,
      set: {
        messages: sql`${chatSessions.messages} || excluded.messages`,
        unread: true,
        updatedAt: new Date(),
      },
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
  const marks = {
    ...(value && { feedback: value }),
    ...(value === "down" && told && { report: told }),
  };
  const [saved] = await db
    .update(chatSessions)
    .set({
      messages: sql`(select jsonb_agg(case when part->>'id' = ${messageId} then jsonb_set(part, '{metadata}', (coalesce(part->'metadata', '{}'::jsonb) - 'feedback' - 'report') || ${JSON.stringify(marks)}::jsonb) else part end order by position) from jsonb_array_elements(${chatSessions.messages}) with ordinality as saved(part, position))`,
      updatedAt: keepUpdatedAt,
    })
    .where(
      and(
        owned(id, by),
        sql`${chatSessions.messages} @> jsonb_build_array(jsonb_build_object('id', ${messageId}::text))`,
      ),
    )
    .returning({ id: chatSessions.id });
  if (!saved) throw new StatusError(404, "no such message");
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
  for (const message of copied) {
    const { report: _report, ...metadata } = message.metadata ?? {};
    message.metadata = metadata;
  }
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

const PAST_CHATS = 5;
const PAST_ANSWER_CHARS = 400;

const textAt = (index: number) =>
  sql<string>`coalesce((select string_agg(part->>'text', ' ') from jsonb_array_elements(${chatSessions.messages} -> ${sql.raw(String(index))} -> 'parts') as part where part->>'type' = 'text'), '')`;

export const searchPastChats = (by: string, except: string, query: string) => {
  const pattern = `%${query.replaceAll(LIKE_SPECIAL, (special) => `\\${special}`)}%`;
  return db
    .select({
      title: chatSessions.title,
      updatedAt: isoTime(chatSessions.updatedAt),
      asked: textAt(0),
      answered: sql<string>`left(${textAt(-1)}, ${PAST_ANSWER_CHARS})`,
    })
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.owner, by),
        ne(chatSessions.id, except),
        or(ilike(chatSessions.title, pattern), sql`${hitIn(query, pattern)} is not null`),
      ),
    )
    .orderBy(desc(chatSessions.updatedAt))
    .limit(PAST_CHATS);
};

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
