import { isToolUIPart } from "ai";
import { type ChatMessage, messageText } from "../shared/messages";

export type Member = { id: string; name: string };

export type Room = { id: string; name: string; members: readonly Member[] };

const labeled = (room: string, message: ChatMessage): ChatMessage => {
  const from = message.metadata?.from;
  const line = from
    ? `[agent] ${from.name} (id: ${from.id}) [Group chat: "${room}"]`
    : `[Group chat: "${room}"] User`;
  return {
    id: message.id,
    role: "user",
    parts: [
      { type: "text", text: `${line}: ${messageText(message)}` },
      ...message.parts.filter((part) => part.type === "file"),
    ],
  };
};

export const roomHistory = (messages: readonly ChatMessage[], room: string, self: string) =>
  messages.map((message): ChatMessage => {
    if (message.metadata?.from?.id === self) return { ...message, role: "assistant" };
    return labeled(room, message);
  });

export const finalReply = (message: ChatMessage): ChatMessage => {
  const lastTool = message.parts.findLastIndex(isToolUIPart);
  return {
    ...message,
    parts: message.parts.filter((part, index) => part.type !== "text" || index > lastTool),
  };
};

const SILENT = /^skip[.!]*$/iu;

export const isSilent = (message: ChatMessage) => {
  const text = messageText(message).trim();
  return text === "" || SILENT.test(text);
};

const escaped = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

export const mentionedBots = (text: string, members: readonly Member[], speaker: string) =>
  members.filter(
    (member) =>
      member.id !== speaker &&
      (/@everyone\b/iu.test(text) ||
        new RegExp(`@${escaped(member.name)}(?!\\w)`, "iu").test(text)),
  );
