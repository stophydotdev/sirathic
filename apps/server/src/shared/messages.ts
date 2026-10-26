import type { InferUITools, UIMessage } from "ai";
import { z } from "zod";
import type { sirathicTools } from "../chat/tools";

export const MODES = ["quick", "research"] as const;

export const mode = z.enum(MODES);

export type Mode = z.infer<typeof mode>;

export const feedback = z.enum(["up", "down"]);

export const reportReason = z.enum(["quote", "school", "source", "ruling", "other"]);

export const report = z.object({
  reason: reportReason,
  details: z.string().trim().max(1000).optional(),
});

export type Report = z.infer<typeof report>;

export const device = z.enum(["phone", "tablet", "desktop"]);

export type Device = z.infer<typeof device>;

export const messageMetadata = z.object({
  createdAt: z.number().optional(),
  mode: mode.optional(),
  model: z.string().optional(),
  feedback: feedback.optional(),
  report: report.optional(),
});

type MessageMetadata = z.infer<typeof messageMetadata>;

export const chatData = {
  related: z.object({ questions: z.array(z.string()) }),
  title: z.object({ title: z.string() }),
};

export type ChatTools = InferUITools<ReturnType<typeof sirathicTools>>;

export type ChatMessage = UIMessage<
  MessageMetadata,
  {
    related: z.output<typeof chatData.related>;
    title: z.output<typeof chatData.title>;
  },
  ChatTools
>;
