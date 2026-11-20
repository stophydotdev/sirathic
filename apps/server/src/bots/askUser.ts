import { getToolName, isToolUIPart, tool } from "ai";
import { z } from "zod";
import type { ChatMessage } from "../shared/messages";
import type { Waiting } from "./taskBook";

export const ASK_USER = "ask_user";

const MAX_CHOICES = 4;
const DETAIL_FIELDS = 4;
const DETAIL_CHARS = 300;

const askUserInput = z.object({
  question: z.string().trim().min(1).max(300),
  choices: z.array(z.string().trim().min(1).max(60)).max(MAX_CHOICES).default([]),
});

export const askUser = tool({
  description:
    "Asks the user one question and pauses this task until they answer on their Tasks page. Use it only for something you cannot finish without them: a value only they know, or a choice between options. Pass up to four short choices when the answer is one of them, or none for a free reply. End your turn right after calling it; you continue with their answer.",
  inputSchema: askUserInput,
});

export const taskAnswer = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("reply"), text: z.string().trim().min(1).max(2000) }),
  z.object({ kind: z.literal("approval"), approved: z.boolean() }),
]);

const inputFields = z
  .record(z.string(), z.union([z.string(), z.number()]).optional().catch(undefined))
  .catch({});

const detailsOf = (fields: z.infer<typeof inputFields>) =>
  Object.entries(fields)
    .flatMap(([field, value]) => (value === undefined ? [] : [`${field}: ${value}`]))
    .slice(0, DETAIL_FIELDS)
    .join("\n")
    .slice(0, DETAIL_CHARS);

export function waitingIn(message: ChatMessage | undefined): Waiting | undefined {
  for (const part of message?.parts.filter(isToolUIPart) ?? []) {
    if (part.state === "approval-requested") {
      return {
        kind: "approval",
        action: getToolName(part),
        details: detailsOf(inputFields.parse(part.input)),
        approvalId: part.approval.id,
      };
    }
    const asked = askUserInput.safeParse(part.input);
    if (getToolName(part) === ASK_USER && part.state === "input-available" && asked.success) {
      return { kind: "question", ...asked.data, callId: part.toolCallId };
    }
  }
  return undefined;
}

export function answerIn(
  message: ChatMessage,
  waiting: Waiting,
  answer: z.infer<typeof taskAnswer>,
) {
  for (const part of message.parts.filter(isToolUIPart)) {
    if (waiting.kind === "approval" && answer.kind === "approval") {
      if (part.state !== "approval-requested") continue;
      Object.assign(part, {
        state: "approval-responded",
        approval: { ...part.approval, approved: answer.approved },
      });
    } else if (
      waiting.kind === "question" &&
      answer.kind === "reply" &&
      part.toolCallId === waiting.callId
    ) {
      Object.assign(part, { state: "output-available", output: { answer: answer.text } });
    }
  }
}
