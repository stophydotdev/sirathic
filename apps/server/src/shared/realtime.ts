import { z } from "zod";

export const realtimeEvent = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("message"), chatId: z.string() }),
  z.object({ kind: z.literal("answering"), chatId: z.string(), answering: z.boolean() }),
  z.object({
    kind: z.literal("approval"),
    chatId: z.string(),
    state: z.enum(["needed", "decided"]),
  }),
  z.object({ kind: z.literal("task"), botId: z.string(), taskId: z.string() }),
  z.object({ kind: z.literal("bot"), botId: z.string() }),
  z.object({ kind: z.literal("run"), automationId: z.string(), chatId: z.string() }),
  z.object({ kind: z.literal("reset") }),
]);

export type RealtimeEvent = z.infer<typeof realtimeEvent>;

export const eventId = z.string().regex(/^\d+-\d+$/u);

export const seenFrame = z.object({ kind: z.literal("seen"), id: eventId });
