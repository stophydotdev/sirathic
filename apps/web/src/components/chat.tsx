"use client";

import { chosenModel } from "@/components/account";
import { localZone } from "@/components/automationText";
import { useChatOptions } from "@/components/chatOptions";
import { usePreferences } from "@/components/preferences";
import { useProjects } from "@/components/projects";
import { useSessions } from "@/components/sessions";
import { Thread } from "@/components/thread";
import { uploadToLibrary } from "@/components/libraryUpload";
import { api } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { fileUrl } from "@sirathic/server/files";
import {
  type ChatMessage,
  chatData,
  type Device,
  messageMetadata,
} from "@sirathic/server/messages";
import { Chat as LiveChat, useChat } from "@ai-sdk/react";
import {
  type AttachmentAdapter,
  AssistantRuntimeProvider,
  CompositeAttachmentAdapter,
  SimpleTextAttachmentAdapter,
} from "@assistant-ui/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import { DefaultChatTransport, validateUIMessages } from "ai";
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
        mode: useProjects.getState().bots?.some((bot) => bot.id === projectId)
          ? "quick"
          : (override?.mode ?? options.mode),
        incognito: options.incognito,
        projectId,
        device: deviceOf(),
        language: document.documentElement.lang,
        timezone: localZone(),
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

const SAVED_WAIT_MS = 3000;
const SAVED_WAITS = 100;

export const savedChat = (id: string) =>
  api.sessions.get.query({ id }).then(async ({ messages, answering: unfinished }) => ({
    unfinished,
    messages: await validateUIMessages<ChatMessage>({
      messages,
      dataSchemas: chatData,
      metadataSchema: messageMetadata,
    }),
  }));

const answerText = (messages: readonly ChatMessage[]) => {
  const last = messages.at(-1);
  return last?.role === "assistant"
    ? last.parts.map((part) => (part.type === "text" ? part.text : "")).join("")
    : "";
};

const lastAsked = (messages: readonly ChatMessage[]) =>
  messages.findLast((message) => message.role === "user")?.id;

const answeredFurther = (saved: readonly ChatMessage[], shown: readonly ChatMessage[]) => {
  const asked = lastAsked(shown);
  return (
    asked !== undefined &&
    lastAsked(saved) === asked &&
    answerText(saved).length > answerText(shown).length
  );
};

const waitForSaved = async (chat: LiveChat<ChatMessage>, waitsLeft = SAVED_WAITS) => {
  const saved = await savedChat(chat.id).catch((err: Error) =>
    err instanceof TRPCClientError && err.data?.code === "NOT_FOUND" ? "gone" : "unreachable",
  );
  if (saved === "gone") return;
  if (saved !== "unreachable" && !saved.unfinished) {
    if (answeredFurther(saved.messages, chat.messages)) {
      chat.clearError();
      chat.messages = saved.messages;
    }
    return;
  }
  if (saved !== "unreachable") chat.clearError();
  if (waitsLeft > 1) {
    setTimeout(() => void waitForSaved(chat, waitsLeft - 1), SAVED_WAIT_MS);
  }
};

const liveChat = (
  id: string,
  messages: ChatMessage[] | undefined,
  projectId: string | undefined,
  unfinished: boolean,
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
    onError: () => void waitForSaved(created),
  });
  const stopHere = created.stop;
  created.stop = async () => {
    void api.sessions.stop.mutate({ id }).catch(() => undefined);
    await stopHere();
  };
  if (unfinished) void waitForSaved(created);
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

export const Chat: FC<{
  id?: string;
  initialMessages?: ChatMessage[];
  projectId?: string;
  unfinished?: boolean;
  home?: string;
}> = ({ id, initialMessages, projectId, unfinished = false, home }) => {
  const [chatId] = useState(() => id ?? crypto.randomUUID());
  const address = home ?? `/c/${chatId}`;
  const incognito = useChatOptions((s) => s.incognito);
  const savedTitle = useSessions(
    (s) => s.sessions?.find((session) => session.id === chatId)?.title,
  );
  const [session] = useState(() => liveChat(chatId, initialMessages, projectId, unfinished));
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
    if (window.location.pathname !== address) {
      window.history.replaceState(null, "", address);
    }
  }, [started, address, incognito]);

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
