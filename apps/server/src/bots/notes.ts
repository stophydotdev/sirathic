import { db } from "@sirathic/db";
import { botNotes, chatSessions, projects } from "@sirathic/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { StatusError } from "../http";
import { containsLink, NOTE_MAX } from "../shared/projects";

export const REASON_MAX = 100;

const BY_USER = "";

const INSTRUCTS_AROUND_RULES =
  /\b(ignore|disregard|forget|override|bypass|jailbreak|pretend)\b|system\s*prompt|developer\s*(message|prompt)|\b(previous|above|earlier|prior)\s+(instructions|rules)|you\s+are\s+now|\bact\s+as\b|\bnew\s+rules\b/iu;

const MAKES_RELIGIOUS_CLAIM =
  /\p{Script=Arabic}|\b(haram|halal|makruh|mustahabb|wajib|fard|fatwa|ruling|permissible|forbidden|obligatory|sinful)\b|\b(allah|the prophet|prophet muhammad|quran|hadith)\s+(says?|said|commands?|tells?|narrated|ordered)\b|\bnarrated\b|\bit\s+is\s+a\s+sin\b/iu;

const teachingOnly = (text: string) =>
  !INSTRUCTS_AROUND_RULES.test(text) && !MAKES_RELIGIOUS_CLAIM.test(text) && !containsLink(text);

const noteText = z.string().trim().max(NOTE_MAX);

export const taughtNote = z.object({
  note: noteText.min(1).refine(teachingOnly),
  reason: z
    .string()
    .trim()
    .min(1)
    .max(REASON_MAX)
    .refine((reason) => !reason.includes("\n") && teachingOnly(reason)),
});

const ownedBot = (id: string, by: string) =>
  and(eq(projects.id, id), eq(projects.owner, by), eq(projects.kind, "bot"));

const ownedNotes = (botId: string, by: string) =>
  and(eq(botNotes.botId, botId), eq(botNotes.owner, by));

const noteColumns = {
  id: botNotes.id,
  note: botNotes.note,
  reason: botNotes.reason,
  createdAt: botNotes.createdAt,
};

export const noteId = z.uuid();

export const setNote = (botId: string, by: string, note: string, reason: string) =>
  db.transaction(async (tx) => {
    const [bot] = await tx
      .select({ note: projects.note })
      .from(projects)
      .where(ownedBot(botId, by));
    if (!bot) throw new StatusError(404, "no such bot");
    if (bot.note === note) return undefined;
    await tx.update(projects).set({ note }).where(ownedBot(botId, by));
    const [entry] = await tx
      .insert(botNotes)
      .values({ owner: by, botId, note, reason })
      .returning(noteColumns);
    return entry;
  });

export async function undoNote(botId: string, by: string, id: string) {
  const [latest, before] = await db
    .select({ id: botNotes.id, note: botNotes.note })
    .from(botNotes)
    .where(ownedNotes(botId, by))
    .orderBy(desc(botNotes.createdAt))
    .limit(2);
  if (latest?.id !== id) throw new StatusError(404, "nothing to undo");
  return setNote(botId, by, before?.note ?? "", BY_USER);
}

export async function learnedLine(botId: string, by: string) {
  const [[latest], [chat]] = await Promise.all([
    db
      .select(noteColumns)
      .from(botNotes)
      .where(ownedNotes(botId, by))
      .orderBy(desc(botNotes.createdAt))
      .limit(1),
    db
      .select({ updatedAt: chatSessions.updatedAt })
      .from(chatSessions)
      .where(and(eq(chatSessions.id, botId), eq(chatSessions.owner, by))),
  ]);
  return latest && latest.reason !== BY_USER && chat && latest.createdAt > chat.updatedAt
    ? { id: latest.id, reason: latest.reason }
    : null;
}
