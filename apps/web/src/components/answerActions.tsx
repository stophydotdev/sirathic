"use client";

import { useT } from "@/components/i18n";
import { useAccount } from "@/components/account";
import { useChatState } from "@/components/chat";
import { MODE_DETAILS, useChatOptions } from "@/components/chatOptions";
import { MODE_ICONS } from "@/components/composer";
import { MakerIcon } from "@/components/makerIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import {
  type ChatMessage,
  feedback as feedbackSchema,
  type Mode,
  MODES,
  mode as modeSchema,
  type Report,
} from "@sirathic/server/messages";
import type { Source } from "@sirathic/server/sources";
import { api } from "@/lib/trpc";
import { useAui, useAuiState } from "@assistant-ui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Download04Icon,
  GitForkIcon,
  MoreHorizontalIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { type FC, type ReactNode, useState } from "react";
import { z } from "zod";

export const actionButton =
  "grid size-7 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

const storedFeedback = z.object({ feedback: feedbackSchema.optional() });

type Feedback = z.infer<typeof feedbackSchema>;

export const messageText = (message: ChatMessage | undefined) =>
  message?.parts.map((part) => (part.type === "text" ? part.text : "")).join("") ?? "";

export function download(name: string, markdown: string) {
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${
    name
      .replaceAll(/[^\p{L}\p{N} -]/gu, "")
      .trim()
      .slice(0, 60) || "answer"
  }.md`;
  link.click();
  URL.revokeObjectURL(url);
}

export function useAnswer() {
  const chat = useChatState();
  const messageId = useAuiState((s) => s.message.id);
  const feedback =
    useAuiState((s) => storedFeedback.safeParse(s.message.metadata.custom).data?.feedback) ?? null;

  const rate = (next: Feedback | null, report?: Report) => {
    if (!chat) return;
    chat.chat.setMessages((messages) =>
      messages.map((message) => {
        if (message.id !== messageId) return message;
        const { feedback: _old, report: _oldReport, ...rest } = message.metadata ?? {};
        return Object.assign({}, message, {
          metadata: next
            ? Object.assign(rest, { feedback: next }, next === "down" && report ? { report } : {})
            : rest,
        });
      }),
    );
    if (chat.saved) {
      void api.sessions.feedback
        .mutate({ id: chat.id, messageId, value: next, report })
        .catch(() => undefined);
    }
  };

  const copy = () =>
    navigator.clipboard.writeText(
      messageText(chat?.chat.messages.find((message) => message.id === messageId)),
    );

  return { feedback, rate, copy };
}

export const AnswerExtras: FC<{
  sources: Source[];
  children?: ReactNode;
}> = ({ sources, children }) => {
  const chat = useChatState();
  const messageId = useAuiState((s) => s.message.id);
  const [forking, setForking] = useState(false);
  const t = useT();

  const fork = async () => {
    if (!chat?.saved) return;
    setForking(true);
    const forked = await api.sessions.fork
      .mutate({ id: chat.id, messageId })
      .catch(() => undefined);
    if (forked) window.location.assign(`/c/${forked.id}`);
    else setForking(false);
  };

  return (
    <>
      <button
        type="button"
        aria-label={t("Fork into a new chat")}
        title={t("Fork into a new chat")}
        disabled={!chat?.saved || forking}
        onClick={() => void fork()}
        className={actionButton}
      >
        <HugeiconsIcon icon={GitForkIcon} className="size-3.5" />
      </button>
      {children}
      <MoreMenu sources={sources} />
    </>
  );
};

const MoreMenu: FC<{ sources: Source[] }> = ({ sources }) => {
  const aui = useAui();
  const messages = useAuiState((s) => s.thread.messages);
  const messageId = useAuiState((s) => s.message.id);
  const chat = useChatState();
  const models = useAccount((s) => s.models);
  const chosen = useAccount((s) => s.chosen);
  const currentMode = useChatOptions((s) => s.mode);
  const [mode, setMode] = useState<Mode>(currentMode);
  const [model, setModel] = useState<string | undefined>(chosen);
  const t = useT();

  const save = () => {
    const stored = chat?.chat.messages ?? [];
    const index = stored.findIndex((message) => message.id === messageId);
    const answer = stored[index];
    const question = stored
      .slice(0, Math.max(index, 0))
      .findLast((message) => message.role === "user");
    const title = messageText(question);
    const sourceList = sources
      .map((source, i) => `${i + 1}. [${source.title}](${source.url})`)
      .join("\n");
    download(
      title,
      `# ${title}\n\n${messageText(answer)}\n${sourceList ? `\n## ${t("Sources")}\n\n${sourceList}\n` : ""}`,
    );
  };

  const rewrite = () => {
    useChatOptions.getState().setOverride({ mode, model });
    aui.message().reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={actionButton} aria-label={t("More actions")}>
        <HugeiconsIcon icon={MoreHorizontalIcon} className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={save} disabled={messages.length === 0}>
          <HugeiconsIcon icon={Download04Icon} className="size-4" />
          {t("Download")}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <HugeiconsIcon icon={RefreshIcon} className="size-4" />
            {t("Rewrite")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-60">
            <DropdownMenuLabel>{t("Mode")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={mode}
              onValueChange={(value) => setMode(modeSchema.parse(value))}
            >
              {MODES.map((name) => (
                <DropdownMenuRadioItem
                  key={name}
                  value={name}
                  onSelect={(event) => event.preventDefault()}
                >
                  {MODE_ICONS[name]}
                  {t(MODE_DETAILS[name].name)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {models.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t("Model")}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={model ?? ""} onValueChange={setModel}>
                  {models.map((option) => (
                    <DropdownMenuRadioItem
                      key={option.slug}
                      value={option.slug}
                      onSelect={(event) => event.preventDefault()}
                    >
                      <MakerIcon maker={option.maker} className="size-4 shrink-0" />
                      {option.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={rewrite}
              className="bg-primary text-primary-foreground focus:bg-primary/90 focus:text-primary-foreground justify-center"
            >
              {t("Rewrite")}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
