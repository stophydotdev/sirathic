"use client";

import { useLocalePath } from "@/components/i18n";
import { chosenModel } from "@/components/account";
import { useChatOptions } from "@/components/chat-options";
import { usePreferences } from "@/components/preferences";
import { useSessions } from "@/components/sessions";
import { Thread } from "@/components/thread";
import type { ChatMessage } from "@sirathic/server/messages";
import { useChat } from "@ai-sdk/react";
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

const transport = new DefaultChatTransport<ChatMessage>({
  api: "/api/chat",
  body: () => {
    const options = useChatOptions.getState();
    const override = options.takeOverride();
    return {
      model: override?.model ?? chosenModel(),
      mode: override?.mode ?? options.mode,
      incognito: options.incognito,
    };
  },
});

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
  const href = useLocalePath();
  const incognito = useChatOptions((s) => s.incognito);
  const chat = useChat<ChatMessage>({
    id: chatId,
    messages: initialMessages,
    transport,
    onData: (part) => {
      if (part.type === "data-title") void useSessions.getState().refresh();
    },
    onFinish: () => {
      if (!useChatOptions.getState().incognito) {
        void useSessions.getState().refresh();
      }
    },
  });
  const runtime = useAISDKRuntime(chat, {
    adapters: { attachments },
  });
  const started = chat.messages.length > 0;

  useEffect(() => {
    usePreferences.getState().load();
    useChatOptions.getState().load();
  }, []);

  useEffect(() => {
    if (!started || incognito) return;
    if (window.location.pathname !== href(`/s/${chatId}`)) {
      window.history.replaceState(null, "", href(`/s/${chatId}`));
    }
  }, [started, chatId, incognito, href]);

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
