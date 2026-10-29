import { db } from "@sirathic/db";
import { chatSessions } from "@sirathic/db/schema";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { StatusError } from "../http";
import { oneEmoji } from "../shared/messages";
import { keepUpdatedAt, messagesOf, owned } from "./sessions";

export const reactionInput = z.object({
  messageId: z.string().min(1),
  emoji: oneEmoji.optional(),
});

export async function setReaction(
  id: string,
  by: string,
  { messageId, emoji }: z.output<typeof reactionInput>,
) {
  const { messages } = await messagesOf(id, by);
  const target = messages.find((message) => message.id === messageId);
  if (!target) throw new StatusError(404, "no such message");
  const metadata = emoji
    ? sql`coalesce(part->'metadata', '{}'::jsonb) || jsonb_build_object('reaction', ${emoji}::text)`
    : sql`coalesce(part->'metadata', '{}'::jsonb) - 'reaction'`;
  await db
    .update(chatSessions)
    .set({
      messages: sql`(select jsonb_agg(case when part->>'id' = ${messageId} then jsonb_set(part, '{metadata}', ${metadata}) else part end order by position) from jsonb_array_elements(${chatSessions.messages}) with ordinality as saved(part, position))`,
      updatedAt: keepUpdatedAt,
    })
    .where(owned(id, by));
  return { reaction: emoji };
}
