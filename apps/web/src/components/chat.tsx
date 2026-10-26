"use client";

import { chosenModel } from "@/components/account";
import { useChatOptions } from "@/components/chatOptions";
import { usePreferences } from "@/components/preferences";
import { useSessions } from "@/components/sessions";
import { Thread } from "@/components/thread";
import { type ChatMessage, type Device } from "@sirathic/server/messages";
import { Chat as LiveChat, useChat } from "@ai-sdk/react";
import {
  type AttachmentAdapter,
  AssistantRuntimeProvider,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
} from "@assistant-ui/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import { DefaultChatTransport } from "ai";
import { createContext, type FC, useContext, useEffect, useState } from "react";
import { z } from "zod";

const dataUrlOf = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const read = z.string().safeParse(reader.result);
      if (read.success) resolve(read.data);
      else reject(new Error(`Could not read ${file.name}`));
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });

const pdfs: AttachmentAdapter = {
  accept: "application/pdf",
  add: async ({ file }) => ({
    id: crypto.randomUUID(),
    type: "document",
    name: file.name,
    contentType: file.type,
    file,
    status: { type: "requires-action", reason: "composer-send" },
  }),
  send: async (attachment) => ({
    ...attachment,
    status: { type: "complete" },
    content: [
      {
        type: "file",
        data: await dataUrlOf(attachment.file),
        mimeType: "application/pdf",
        filename: attachment.name,
      },
    ],
  }),
  remove: async () => undefined,
};

const attachments = new CompositeAttachmentAdapter([
  new SimpleImageAttachmentAdapter(),
  new SimpleTextAttachmentAdapter(),
  pdfs,
]);

const deviceOf = (): Device => {
  if (!matchMedia("(pointer: coarse)").matches) return "desktop";
  return Math.min(screen.width, screen.height) < 600 ? "phone" : "tablet";
};

const transport = new DefaultChatTransport<ChatMessage>({
  api: "/api/chat",
  body: () => {
    const options = useChatOptions.getState();
    const override = options.takeOverride();
    return {
      model: override?.model ?? chosenModel(),
      mode: override?.mode ?? options.mode,
      incognito: options.incognito,
      device: deviceOf(),
      language: document.documentElement.lang,
    };
  },
});

const live = new Map<string, LiveChat<ChatMessage>>();

export const isLive = (id: string) => live.has(id);

const refreshSaved = () => {
  if (!useChatOptions.getState().incognito) void useSessions.getState().refresh();
};

const liveChat = (id: string, messages: ChatMessage[] | undefined) => {
  const found = live.get(id);
  if (found) return found;
  const created = new LiveChat<ChatMessage>({
    id,
    messages,
    transport,
    onData: (part) => {
      if (part.type === "data-title") void useSessions.getState().refresh();
    },
    onFinish: refreshSaved,
  });
  live.set(id, created);
  return created;
};

type ChatState = {
  id: string;
  saved: boolean;
  chat: ReturnType<typeof useChat<ChatMessage>>;
};

const ChatContext = createContext<ChatState | undefined>(undefined);

export const useChatState = () => useContext(ChatContext);

export const Chat: FC<{ id?: string; initialMessages?: ChatMessage[] }> = ({
  id,
  initialMessages,
}) => {
  const [chatId] = useState(() => id ?? crypto.randomUUID());
  const incognito = useChatOptions((s) => s.incognito);
  const savedTitle = useSessions(
    (s) => s.sessions?.find((session) => session.id === chatId)?.title,
  );
  const [session] = useState(() => liveChat(chatId, initialMessages));
  const chat = useChat<ChatMessage>({ chat: session });
  const runtime = useAISDKRuntime(chat, {
    adapters: { attachments },
  });
  const started = chat.messages.length > 0;
  const question = chat.messages
    .find((message) => message.role === "user")
    ?.parts.find((part) => part.type === "text")?.text;
  const title = incognito ? undefined : (savedTitle ?? question);

  useEffect(() => {
    usePreferences.getState().load();
    useChatOptions.getState().load();
  }, []);

  useEffect(() => {
    if (!started || incognito) return;
    if (window.location.pathname !== `/c/${chatId}`) {
      window.history.replaceState(null, "", `/c/${chatId}`);
    }
  }, [started, chatId, incognito]);

  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} - Sirathic`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <ChatContext value={{ id: chatId, saved: !incognito, chat }}>
      <AssistantRuntimeProvider runtime={runtime}>
        <main className="h-dvh print:h-auto">
          <Thread />
        </main>
      </AssistantRuntimeProvider>
    </ChatContext>
  );
};
