import { db } from "@sirathic/db";
import { chatSessions, projects } from "@sirathic/db/schema";
import { validateUIMessages } from "ai";
import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import type { ChatMessage } from "../shared/messages";
import { type Source, source } from "../shared/sources";
import { keepUpdatedAt, messageSchemas, owned } from "./sessions";

const withSources = z.object({ sources: z.array(source) });
const CITED_URL = /\]\((https?:\/\/[^)\s]+)\)/gu;

const textOf = (message: ChatMessage) =>
  message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();

const sourcesOf = (messages: ChatMessage[], answers: string) => {
  const found = new Map<string, Source>();
  for (const part of messages.flatMap((message) => message.parts)) {
    if (!("output" in part)) continue;
    for (const entry of withSources.safeParse(part.output).data?.sources ?? []) {
      if (!found.has(entry.url)) found.set(entry.url, entry);
    }
  }
  const cited = [...answers.matchAll(CITED_URL)].map((match) => match[1]);
  const rank = (url: string) => (cited.includes(url) ? cited.indexOf(url) : cited.length);
  return [...found.values()].toSorted((a, b) => rank(a.url) - rank(b.url));
};

export async function publishSession(id: string, by: string, published: boolean) {
  const [bot] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.kind, "bot")));
  if (bot) return undefined;
  const [row] = await db
    .update(chatSessions)
    .set({ publishedAt: published ? new Date() : null, updatedAt: keepUpdatedAt })
    .where(owned(id, by))
    .returning({ publishedAt: chatSessions.publishedAt });
  return row && { published: row.publishedAt !== null };
}

export async function publishedPage(id: string) {
  const [row] = await db
    .select({
      title: chatSessions.title,
      messages: chatSessions.messages,
      publishedAt: chatSessions.publishedAt,
    })
    .from(chatSessions)
    .where(and(eq(chatSessions.id, id), isNotNull(chatSessions.publishedAt)));
  if (!row?.publishedAt) return undefined;
  const messages = await validateUIMessages<ChatMessage>({
    messages: row.messages,
    ...messageSchemas,
  }).catch(() => undefined);
  if (!messages) return undefined;
  const turns = messages.flatMap((message, index) => {
    const reply = messages[index + 1];
    const question = textOf(message);
    const answer = reply?.role === "assistant" ? textOf(reply) : "";
    return message.role === "user" && question && answer ? [{ question, answer }] : [];
  });
  if (turns.length === 0) return undefined;
  return {
    title: row.title,
    publishedAt: row.publishedAt.toISOString(),
    turns,
    sources: sourcesOf(messages, turns.map((turn) => turn.answer).join("\n")),
  };
}
