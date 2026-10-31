import { db } from "@sirathic/db";
import { chatSessions, users } from "@sirathic/db/schema";
import { env } from "@sirathic/env/server";
import { TRPCError } from "@trpc/server";
import { validateUIMessages } from "ai";
import { and, eq, sql } from "drizzle-orm";
import { type ChatMessage, messageText } from "../shared/messages";
import { procedure } from "../trpc";
import { sourcesOf } from "./pages";
import { messageSchemas } from "./sessions";

const reviewers = new Set(
  env.REVIEWERS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export const reviewer = procedure.use(async ({ ctx, next }) => {
  const [verified] =
    ctx.user?.email && reviewers.has(ctx.user.email.toLowerCase())
      ? await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, ctx.user.id), eq(users.emailVerified, true)))
      : [];
  if (!verified) throw new TRPCError({ code: "NOT_FOUND", message: "not found" });
  return next();
});

export const sharedReports = (messages: ChatMessage[], chatDate: Date) =>
  messages.flatMap((message, index) => {
    const report = message.metadata?.report;
    if (message.role !== "assistant" || !report?.shared) return [];
    const asked = messages.slice(0, index).findLastIndex((earlier) => earlier.role === "user");
    const answer = messageText(message).trim();
    return [
      {
        id: message.id,
        reason: report.reason,
        details: report.details,
        question: messageText(messages[asked]).trim(),
        answer,
        sources: sourcesOf(messages.slice(asked + 1, index + 1), answer),
        at: new Date(message.metadata?.createdAt ?? chatDate).toISOString(),
      },
    ];
  });

export async function listSharedReports() {
  const rows = await db
    .select({ messages: chatSessions.messages, createdAt: chatSessions.createdAt })
    .from(chatSessions)
    .where(
      sql`jsonb_path_exists(${chatSessions.messages}, '$[*].metadata.report ? (@.shared == true)')`,
    );
  const reports = await Promise.all(
    rows.map((row) =>
      validateUIMessages<ChatMessage>({ messages: row.messages, ...messageSchemas })
        .then((messages) => sharedReports(messages, row.createdAt))
        .catch(() => []),
    ),
  );
  return reports.flat().toSorted((a, b) => b.at.localeCompare(a.at));
}
