"use client";

import { chosenModel, currentModel } from "@/components/account";
import { notify } from "@/components/automationAlerts";
import { localZone } from "@/components/automationText";
import { useChatOptions } from "@/components/chatOptions";
import { nextFollowUp } from "@/components/followUps";
import { usePreferences } from "@/components/preferences";
import { useGroups, useGroupTyping } from "@/components/groups";
import { useProjects } from "@/components/projects";
import { useSessions } from "@/components/sessions";
import { Thread } from "@/components/thread";
import { uploadToLibrary } from "@/components/libraryUpload";
import { api } from "@/lib/trpc";
import { deviceOf } from "@/lib/visit";
import { TRPCClientError } from "@trpc/client";
import { DOCX, fileUrl } from "@sirathic/server/files";
import { prependQuote } from "@sirathic/app/botQuote";
import {
  type ChatMessage,
  chatData,
  messageMetadata,
  messageText,
} from "@sirathic/server/messages";
import { Chat as LiveChat, useChat } from "@ai-sdk/react";
import {
  type AttachmentAdapter,
  AssistantRuntimeProvider,
  CompositeAttachmentAdapter,
  SimpleTextAttachmentAdapter,
} from "@assistant-ui/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import {
  DefaultChatTransport,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  validateUIMessages,
} from "ai";
import { createContext, type FC, useContext, useEffect, useState } from "react";
import { z } from "zod";
import { create } from "zustand";

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

const storedAttachments = (accept: string, kind: "image" | "document"): AttachmentAdapter => ({
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
              mimeType:
                attachment.contentType === DOCX || /\.docx$/iu.test(attachment.name)
                  ? DOCX
                  : "application/pdf",
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
  storedAttachments(`application/pdf,.docx,${DOCX}`, "document"),
]);

const transportIn = (projectId: string | undefined) =>
  new DefaultChatTransport<ChatMessage>({
    api: "/api/chat",
    body: () => {
      const options = useChatOptions.getState();
      const override = options.takeOverride();
      const inBot = useProjects.getState().bots?.some((bot) => bot.id === projectId);
      return {
        model: override?.model ?? chosenModel(),
        mode: inBot ? "quick" : (override?.mode ?? options.mode),
        effort: options.effort,
        sources: inBot ? undefined : options.sources,
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

const seen = (id: string) => window.location.pathname.endsWith(`/${id}`);

const markAnswered = (id: string) => {
  if (!useChatOptions.getState().incognito) {
    void useSessions.getState().change(id, { unread: !seen(id) });
  }
};

const SAVED_WAIT_MS = 3000;
const SAVED_WAITS = 100;

export const savedChat = (id: string, peek?: true) =>
  api.sessions.get.query({ id, peek }).then(async ({ messages, answering: unfinished }) => ({
    unfinished,
    messages: await validateUIMessages<ChatMessage>({
      messages,
      dataSchemas: chatData,
      metadataSchema: messageMetadata,
    }),
  }));

const prefetched = new Map<string, Promise<ChatMessage[] | undefined>>();

const listed = (id: string) =>
  useSessions.getState().sessions?.find((session) => session.id === id);

export const prefetchChat = (id: string) => {
  if (!listed(id) || live.has(id) || prefetched.has(id)) return;
  prefetched.set(
    id,
    savedChat(id, true).then(
      (found) => found.messages,
      () => undefined,
    ),
  );
};

export const keptMessages = (id: string) => (listed(id) ? live.get(id)?.messages : undefined);

export const prefetchedMessages = (id: string) => (listed(id) ? prefetched.get(id) : undefined);

export const outdated = (kept: readonly ChatMessage[], saved: readonly ChatMessage[]) =>
  kept.length !== saved.length || answerText(kept) !== answerText(saved);

const answerText = (messages: readonly ChatMessage[]) => {
  const last = messages.at(-1);
  return last?.role === "assistant" ? messageText(last) : "";
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
    if (seen(chat.id)) markAnswered(chat.id);
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

const BACKGROUND_POLL_MS = 4000;

const syncBackground = async (chat: LiveChat<ChatMessage>) => {
  void useSessions.getState().refresh();
  const saved = await savedChat(chat.id, true).catch(() => undefined);
  if (!saved || saved.unfinished || answering(chat)) return;
  if (saved.messages.length > chat.messages.length) {
    chat.messages = saved.messages;
    markAnswered(chat.id);
  }
};

const TEAMMATE_POLL_MS = 3000;

const adoptTeammateMessages = (chat: LiveChat<ChatMessage>) => {
  if (answering(chat) || (useProjects.getState().bots?.length ?? 0) < 2) return;
  void savedChat(chat.id, true).then(
    (saved) => {
      useGroupTyping.setState({ [chat.id]: saved.unfinished });
      if (!answering(chat) && saved.messages.length > chat.messages.length) {
        chat.messages = saved.messages;
        if (seen(chat.id)) markAnswered(chat.id);
      }
    },
    () => undefined,
  );
};

const RESUME_GRACE_MS = 5000;

const useLimitResume = create<Record<string, number>>(() => ({}));

export const useResumeAt = (chatId: string | undefined) =>
  useLimitResume((s) => (chatId === undefined ? undefined : s[chatId]));

const resumeAfterLimit = async (chat: LiveChat<ChatMessage>) => {
  if (currentModel()?.maker !== "sirathic") return;
  const usage = await api.account.usage.query().catch(() => undefined);
  const resetAt = usage?.noor.findLast((window) => window.usedPercent >= 100)?.resetAt;
  if (!resetAt) return;
  const asked = lastAsked(chat.messages);
  useLimitResume.setState({ [chat.id]: resetAt });
  setTimeout(
    () => {
      useLimitResume.setState(
        (waiting) => Object.fromEntries(Object.entries(waiting).filter(([id]) => id !== chat.id)),
        true,
      );
      if (!answering(chat) && lastAsked(chat.messages) === asked) void chat.regenerate();
    },
    resetAt - Date.now() + RESUME_GRACE_MS,
  );
};

const NOTE_CHARS = 140;

const announceAnswer = (id: string, path: string, message: ChatMessage) => {
  const watching =
    document.visibilityState === "visible" && window.location.pathname.endsWith(`/${id}`);
  if (watching || !usePreferences.getState().answerAlerts) return;
  const title =
    useSessions.getState().sessions?.find((session) => session.id === id)?.title ?? "Sirathic";
  notify(path, title, answerText([message]).slice(0, NOTE_CHARS));
};

const liveChat = (
  id: string,
  messages: ChatMessage[] | undefined,
  projectId: string | undefined,
  unfinished: boolean,
) => {
  const found = live.get(id);
  if (found && (answering(found) || useLimitResume.getState()[id] !== undefined)) return found;
  const created = new LiveChat<ChatMessage>({
    id,
    messages,
    transport: transportIn(projectId),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onData: (part) => {
      if (part.type === "data-title") void useSessions.getState().refresh();
    },
    onFinish: ({ message, isAbort, isError }) => {
      markAnswered(id);
      if (isAbort || isError) return;
      if (useGroups.getState().groups?.some((group) => group.id === id)) {
        adoptTeammateMessages(created);
        return;
      }
      announceAnswer(id, projectId === id ? `/bot/${id}` : `/c/${id}`, message);
      const waiting = message.parts.some(
        (part) => isToolUIPart(part) && part.state === "approval-requested",
      );
      const next = waiting ? undefined : nextFollowUp(id);
      if (next !== undefined) {
        void created.sendMessage({ text: next, metadata: { createdAt: Date.now() } });
      }
    },
    onError: () => {
      void waitForSaved(created);
      void resumeAfterLimit(created);
    },
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

const outgoingQuote = z.object({
  custom: z.object({ quote: z.object({ text: z.string() }) }),
});

const botSendMessage =
  (sendMessage: ChatState["chat"]["sendMessage"]): typeof sendMessage =>
  (message, options) => {
    const quote = outgoingQuote.safeParse(message?.metadata).data?.custom.quote.text;
    if (!message || quote === undefined) return sendMessage(message, options);
    if (message.parts) {
      const firstText = message.parts.findIndex((part) => part.type === "text");
      const parts = message.parts.map((part, index) =>
        index === firstText && part.type === "text"
          ? { ...part, text: prependQuote(quote, part.text) }
          : part,
      );
      if (firstText < 0) parts.unshift({ type: "text", text: prependQuote(quote, "") });
      return sendMessage({ ...message, parts }, options);
    }
    return sendMessage(
      {
        ...message,
        text: prependQuote(quote, "text" in message ? (message.text ?? "") : ""),
      },
      options,
    );
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
  const chat = useChat<ChatMessage>({ chat: session, resume: session.messages.length > 0 });
  const inGroup = useGroups((s) => s.groups?.some((group) => group.id === chatId) === true);
  const runtime = useAISDKRuntime(
    projectId === chatId ? { ...chat, sendMessage: botSendMessage(chat.sendMessage) } : chat,
    { adapters: { attachments }, joinStrategy: inGroup ? "none" : "concat-content" },
  );
  const started = chat.messages.length > 0;
  const streaming = chat.status === "streaming";
  const busyInBackground = useSessions(
    (s) => s.sessions?.find((found) => found.id === chatId)?.working === true,
  );
  const question = chat.messages
    .find((message) => message.role === "user")
    ?.parts.find((part) => part.type === "text")?.text;
  const title = incognito ? undefined : (savedTitle ?? question);
  const botName = useProjects((s) => s.bots?.find((bot) => bot.id === projectId)?.name);

  useEffect(() => {
    usePreferences.getState().load();
    useChatOptions.getState().load();
  }, []);

  useEffect(() => {
    if (streaming) refreshSaved();
  }, [streaming]);

  useEffect(() => {
    if (!busyInBackground || projectId !== chatId) return;
    const timer = setInterval(() => void syncBackground(session), BACKGROUND_POLL_MS);
    return () => {
      clearInterval(timer);
      setTimeout(() => void syncBackground(session), BACKGROUND_POLL_MS / 2);
    };
  }, [busyInBackground, projectId, chatId, session]);

  useEffect(() => {
    if (projectId !== chatId || incognito) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") adoptTeammateMessages(session);
    }, TEAMMATE_POLL_MS);
    return () => clearInterval(timer);
  }, [projectId, chatId, incognito, session]);

  useEffect(() => {
    const { sessions, change } = useSessions.getState();
    if (sessions?.some((opened) => opened.id === chatId && opened.unread)) {
      void change(chatId, { unread: false });
    }
  }, [chatId]);

  useEffect(() => {
    if (!started || incognito) return;
    if (window.location.pathname !== address) {
      window.history.replaceState(null, "", address);
    }
  }, [started, address, incognito]);

  useEffect(() => {
    const tab = botName === undefined ? title && `${title} - Sirathic` : `${botName} · Sirathic`;
    if (!tab) return;
    const previous = document.title;
    document.title = tab;
    return () => {
      document.title = previous;
    };
  }, [botName, title]);

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
