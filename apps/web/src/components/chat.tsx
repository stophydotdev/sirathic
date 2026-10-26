"use client";

import { chosenModel } from "@/components/account";
import { useChatOptions } from "@/components/chatOptions";
import { usePreferences } from "@/components/preferences";
import { useSessions } from "@/components/sessions";
import { Thread } from "@/components/thread";
import { uploadToLibrary } from "@/components/libraryUpload";
import { fileUrl } from "@sirathic/server/files";
import { type ChatMessage, type Device } from "@sirathic/server/messages";
import { Chat as LiveChat, useChat } from "@ai-sdk/react";
import {
  type AttachmentAdapter,
  AssistantRuntimeProvider,
  CompositeAttachmentAdapter,
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

const attachmentUrl = async (file: File) => {
  if (useChatOptions.getState().incognito) return dataUrlOf(file);
  const id = await uploadToLibrary(file).catch(() => undefined);
  return id ? fileUrl(location.origin, id) : dataUrlOf(file);
};

const storedAttachments = (accept: string, kind: "image" | "pdf"): AttachmentAdapter => ({
  accept,
  add: async ({ file }) => ({
    id: crypto.randomUUID(),
    type: kind === "image" ? "image" : "document",
    name: file.name,
    contentType: file.type,
    file,
    status: { type: "requires-action", reason: "composer-send" },
  }),
  send: async (attachment) => {
    const url = await attachmentUrl(attachment.file);
    return {
      ...attachment,
      status: { type: "complete" },
      content: [
        kind === "image"
          ? { type: "image", image: url }
          : {
              type: "file",
              data: url,
              mimeType: "application/pdf",
              filename: attachment.name,
            },
      ],
    };
  },
  remove: async () => undefined,
});

const attachments = new CompositeAttachmentAdapter([
  storedAttachments("image/png,image/jpeg,image/gif,image/webp", "image"),
  new SimpleTextAttachmentAdapter(),
  storedAttachments("application/pdf", "pdf"),
]);

const deviceOf = (): Device => {
  if (!matchMedia("(pointer: coarse)").matches) return "desktop";
  return Math.min(screen.width, screen.height) < 600 ? "phone" : "tablet";
};

const transportIn = (projectId: string | undefined) =>
  new DefaultChatTransport<ChatMessage>({
    api: "/api/chat",
    body: () => {
      const options = useChatOptions.getState();
      const override = options.takeOverride();
      return {
        model: override?.model ?? chosenModel(),
        mode: override?.mode ?? options.mode,
        incognito: options.incognito,
        projectId,
        device: deviceOf(),
        language: document.documentElement.lang,
      };
    },
  });

const live = new Map<string, LiveChat<ChatMessage>>();

const answering = (chat: LiveChat<ChatMessage>) =>
  chat.status === "submitted" || chat.status === "streaming";

export const isAnswering = (id: string) => {
  const found = live.get(id);
  return found !== undefined && answering(found);
};

const refreshSaved = () => {
  if (!useChatOptions.getState().incognito) void useSessions.getState().refresh();
};

const liveChat = (
  id: string,
  messages: ChatMessage[] | undefined,
  projectId: string | undefined,
) => {
  const found = live.get(id);
  if (found && answering(found)) return found;
  const created = new LiveChat<ChatMessage>({
    id,
    messages,
    transport: transportIn(projectId),
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
  projectId: string | undefined;
  saved: boolean;
  chat: ReturnType<typeof useChat<ChatMessage>>;
};

const ChatContext = createContext<ChatState | undefined>(undefined);

export const useChatState = () => useContext(ChatContext);

export const Chat: FC<{ id?: string; initialMessages?: ChatMessage[]; projectId?: string }> = ({
  id,
  initialMessages,
  projectId,
}) => {
  const [chatId] = useState(() => id ?? crypto.randomUUID());
  const incognito = useChatOptions((s) => s.incognito);
  const savedTitle = useSessions(
    (s) => s.sessions?.find((session) => session.id === chatId)?.title,
  );
  const [session] = useState(() => liveChat(chatId, initialMessages, projectId));
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
    <ChatContext value={{ id: chatId, projectId, saved: !incognito, chat }}>
      <AssistantRuntimeProvider runtime={runtime}>
        <main className="h-dvh print:h-auto">
          <Thread />
        </main>
      </AssistantRuntimeProvider>
    </ChatContext>
  );
};
