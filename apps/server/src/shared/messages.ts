import type { InferUITools, UIMessage } from "ai";
import { z } from "zod";
import type { sirathicTools } from "../chat/tools";

export const MODES = ["quick", "research"] as const;

export const mode = z.enum(MODES);

export type Mode = z.infer<typeof mode>;

export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;

export const effort = z.enum(EFFORTS);

export type Effort = z.infer<typeof effort>;

export const DEFAULT_EFFORT = { quick: "high", research: "high" } as const satisfies Record<
  Mode,
  Effort
>;

export const oneEmoji = z
  .emoji()
  .max(16)
  .refine((text) => [...new Intl.Segmenter().segment(text)].length === 1, "send exactly one emoji");

export const feedback = z.enum(["up", "down"]);

export const reportReason = z.enum(["quote", "school", "source", "ruling", "other"]);

export const report = z.object({
  reason: reportReason,
  details: z.string().trim().max(1000).optional(),
  shared: z.boolean().default(false),
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
  reaction: oneEmoji.optional(),
  report: report.optional(),
  routine: z.string().optional(),
  formReply: z.enum(["filled", "missed", "dismissed"]).optional(),
  wake: z.literal(true).optional(),
  picked: z.literal(true).optional(),
  memory: z.boolean().optional(),
  from: z.object({ id: z.uuid(), name: z.string() }).optional(),
  cited: z.record(z.string(), z.string()).optional(),
});

type MessageMetadata = z.infer<typeof messageMetadata>;

export const ANSWER_MAX = 80;

export const question = z.object({
  question: z.string().trim().min(1).max(120),
  options: z.array(z.string().trim().min(1).max(ANSWER_MAX)).min(2).max(5),
  multiple: z.boolean().optional(),
});

export const questionAnswer = z.enum(["option", "own", "dismissed"]);

export const chatData = {
  related: z.object({ questions: z.array(z.string()) }),
  research: z.object({ rationale: z.string() }),
  title: z.object({ title: z.string() }),
};

const RENAMED_TOOLS = new Map([
  ["search", "search_web"],
  ["webFetch", "fetch_url"],
  ["askUser", "clarifying_questions"],
  ["remember", "update_memory"],
  ["learnAboutUser", "update_memory"],
  ["createAutomation", "update_routine"],
  ["listAutomations", "list_routines"],
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

const oldCall = <Input extends z.ZodType>(
  name: string,
  oldInput: Input,
  convert: (input: z.output<Input>) => object,
) =>
  z
    .looseObject({ type: z.literal(`tool-${name}`), input: oldInput.optional() })
    .transform(({ input, ...part }) => ({
      ...part,
      type: `tool-${currentToolName(name)}`,
      ...(input && { input: convert(input) }),
    }));

const sentPart = z.union([
  oldCall("createAutomation", z.looseObject({}), (input) => ({ action: "create", ...input })),
  oldCall(
    "remember",
    z.object({ fact: z.string().nullish(), replaces: z.string().nullish() }),
    ({ fact, replaces }) => ({ write: fact ?? undefined, forget: replaces ?? undefined }),
  ),
  oldCall(
    "learnAboutUser",
    z.object({ text: z.string(), replaces: z.string().nullish() }),
    ({ text, replaces }) => ({ write: text, forget: replaces ?? undefined }),
  ),
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
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(sentPart),
});

export type ChatTools = InferUITools<ReturnType<typeof sirathicTools>>;

export type ChatMessage = UIMessage<
  MessageMetadata,
  {
    related: z.output<typeof chatData.related>;
    research: z.output<typeof chatData.research>;
    title: z.output<typeof chatData.title>;
  },
  ChatTools
>;

export const messageText = (message: Pick<ChatMessage, "parts"> | undefined) =>
  message?.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n\n") ?? "";
