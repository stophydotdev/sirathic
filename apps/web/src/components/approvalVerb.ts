import type { ToolCall } from "@/components/confirmShell";
import type { MessageKey } from "@/messages/en";
import { type ActionKind, actionOf } from "@sirathic/server/confirm";

const VERBS = {
  delete: { label: "Delete", danger: true },
  refund: { label: "Refund", danger: true },
  pay: { label: "Pay", danger: true },
  send: { label: "Send", danger: false },
  post: { label: "Post", danger: false },
  cancel: { label: "Confirm", danger: false },
} as const satisfies Record<ActionKind, { label: MessageKey; danger: boolean }>;

const OTHER = { label: "Confirm", danger: false } as const;

export const approveAs = ({ toolName, args }: Pick<ToolCall, "toolName" | "args">) => {
  const kind = actionOf({ toolName, input: args });
  return kind ? VERBS[kind] : OTHER;
};
