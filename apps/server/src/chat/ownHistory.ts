import { isToolUIPart, validateUIMessages } from "ai";
import { z } from "zod";
import { StatusError } from "../http";
import { type ChatMessage, messageMetadata, type sentMessage } from "../shared/messages";
import { messageSchemas, postedIn } from "./sessions";

type Sent = z.output<typeof sentMessage>;

const asked = z.looseObject({
  toolCallId: z.string(),
  state: z.literal("approval-requested"),
  approval: z.looseObject({ id: z.string() }),
});

const answered = z.looseObject({
  toolCallId: z.string(),
  state: z.literal("approval-responded"),
  approval: z.object({ id: z.string(), approved: z.boolean(), reason: z.string().optional() }),
});

const userMetadata = messageMetadata.pick({ createdAt: true, formReply: true, picked: true });

const STOPPED = "The user moved on before this finished.";

const decisionFor = (part: ChatMessage["parts"][number], sent: Sent) => {
  const request = asked.safeParse(part).data;
  const answer = sent.parts
    .flatMap((each) => answered.safeParse(each).data ?? [])
    .find(
      ({ toolCallId, approval }) =>
        toolCallId === request?.toolCallId && approval.id === request.approval.id,
    );
  return request && answer ? { request, answer } : undefined;
};

const withDecisions = (kept: ChatMessage, sent: Sent, finished: boolean) => ({
  ...kept,
  parts: kept.parts.map((part) => {
    if (
      finished &&
      isToolUIPart(part) &&
      (part.state === "input-streaming" ||
        part.state === "input-available" ||
        part.state === "approval-requested")
    ) {
      const open = Object.entries(part).filter(([key]) => key !== "approval");
      return { ...Object.fromEntries(open), state: "output-error", errorText: STOPPED };
    }
    const decision = decisionFor(part, sent);
    if (!decision) return part;
    const { approved, reason } = decision.answer.approval;
    return {
      ...part,
      state: decision.answer.state,
      approval: { ...decision.request.approval, approved, ...(reason !== undefined && { reason }) },
    };
  }),
});

const onlyParts = (message: Sent, types: readonly string[]) =>
  message.parts.filter((part) => types.includes(part.type));

export async function ownHistory(sent: Sent[], stored: ChatMessage[] | undefined) {
  const unverified = new Set<string>();
  let at = 0;
  const posted = stored ? postedIn(stored) : new Set<string>();
  const history = sent.flatMap((message, index): object[] => {
    if (!stored) return [message];
    const next = stored.findIndex(
      (item, position) => position >= at && (item.id === message.id || !posted.has(item.id)),
    );
    const kept = stored[next];
    if (kept?.id === message.id && kept.role === message.role) {
      at = next + 1;
      if (
        kept.role === "assistant" &&
        index === sent.length - 1 &&
        !kept.parts.some((part) => decisionFor(part, message))
      ) {
        throw new StatusError(409, "this card was already answered");
      }
      return [
        kept.role === "assistant" ? withDecisions(kept, message, index < sent.length - 1) : kept,
      ];
    }
    const last = index === sent.length - 1;
    if (message.role === "user") {
      const parts = onlyParts(message, ["text", "file"]);
      if (last) {
        const metadata = userMetadata.safeParse(message.metadata).data ?? {};
        return [{ id: message.id, role: message.role, metadata, parts }];
      }
      unverified.add(message.id);
      return parts.length > 0 ? [{ id: message.id, role: message.role, metadata: {}, parts }] : [];
    }
    const parts = onlyParts(message, ["text"]);
    if (last) throw new StatusError(409, "send a question or answer a card");
    if (parts.length === 0) return [];
    unverified.add(message.id);
    return [{ id: message.id, role: message.role, metadata: {}, parts }];
  });
  const messages = await validateUIMessages<ChatMessage>({
    messages: history,
    ...messageSchemas,
  }).catch((err: Error) => {
    throw new StatusError(400, err.message);
  });
  return { messages, unverified };
}
