import type { InferUITools, UIMessage } from "ai";
import { z } from "zod";
import type { sirathicTools } from "../chat/tools";

export const MODES = ["quick", "research"] as const;

export const mode = z.enum(MODES);

export type Mode = z.infer<typeof mode>;

export const EFFORTS = ["low", "medium", "high"] as const;

export const effort = z.enum(EFFORTS);

export type Effort = z.infer<typeof effort>;

const NOOR_EFFORT = { quick: "low", research: "high" } as const satisfies Record<Mode, Effort>;

export const defaultEffort = (turn: { mode: Mode; noor: boolean }): Effort =>
  turn.noor ? NOOR_EFFORT[turn.mode] : "high";

export const feedback = z.enum(["up", "down"]);

export const reportReason = z.enum(["quote", "school", "source", "ruling", "other"]);

export const report = z.object({
  reason: reportReason,
  details: z.string().trim().max(1000).optional(),
});

export type Report = z.infer<typeof report>;

export const device = z.enum(["phone", "tablet", "desktop"]);

export const appLanguage = z.string().regex(/^[a-z]{2,3}$/u);

export type Device = z.infer<typeof device>;

export const messageMetadata = z.object({
  createdAt: z.number().optional(),
  mode: mode.optional(),
  model: z.string().optional(),
  feedback: feedback.optional(),
  report: report.optional(),
  routine: z.string().optional(),
});

type MessageMetadata = z.infer<typeof messageMetadata>;

export const ANSWER_MAX = 80;

export const question = z.object({
  question: z.string().trim().min(1).max(120),
  options: z.array(z.string().trim().min(1).max(ANSWER_MAX)).min(2).max(5),
});

export const chatData = {
  related: z.object({ questions: z.array(z.string()) }),
  title: z.object({ title: z.string() }),
};

const RENAMED_TOOLS = new Map([
  ["search", "search_web"],
  ["webFetch", "fetch_url"],
  ["askUser", "clarifying_questions"],
  ["remember", "update_memory"],
  ["learnAboutUser", "update_memory"],
  ["quranGet", "get_verses"],
  ["duaSearch", "search_duas"],
  ["setBotJob", "set_bot_job"],
]);

export const currentToolName = (name: string) => RENAMED_TOOLS.get(name) ?? name;

const oldPageRead = z.looseObject({
  type: z.literal("tool-webFetch"),
  input: z.looseObject({ url: z.string() }).optional(),
  output: z.looseObject({ sources: z.array(z.unknown()) }).optional(),
});

const sentPart = z.union([
  oldPageRead.transform(({ input, output, ...part }) => {
    const { sources, ...page } = output ?? { sources: [] };
    return {
      ...part,
      type: "tool-fetch_url",
      ...(input && { input: { urls: [input.url] } }),
      ...(output && { output: { pages: [page], sources } }),
    };
  }),
  z.looseObject({
    type: z
      .string()
      .transform((type) =>
        type.startsWith("tool-") ? `tool-${currentToolName(type.slice(5))}` : type,
      ),
  }),
]);

export const sentMessage = z.looseObject({
  role: z.enum(["user", "assistant"]),
  parts: z.array(sentPart),
});

export type ChatTools = InferUITools<ReturnType<typeof sirathicTools>>;

export type ChatMessage = UIMessage<
  MessageMetadata,
  {
    related: z.output<typeof chatData.related>;
    title: z.output<typeof chatData.title>;
  },
  ChatTools
>;
