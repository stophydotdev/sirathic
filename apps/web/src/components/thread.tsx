"use client";

import { useChatState } from "@/components/chat";
import { useChatOptions } from "@/components/chatOptions";
import { AttachmentChip, Composer } from "@/components/composer";
import { useT } from "@/components/i18n";
import { Mark } from "@/components/logo";
import { UserText } from "@/components/mentions";
import { useOpenSources } from "@/components/openSources";
import { BotTurn } from "@/components/botChat";
import { BotGreeting, BotHeaderMenu, BotHome, BotTitle, useBot } from "@/components/botHome";
import { BotLearned } from "@/components/botLearned";
import { ThreadKeys } from "@/components/shortcuts";
import { ThreadShell } from "@/components/threadShell";
import { Swap } from "@/components/swap";
import { cn } from "@/lib/utils";
import { api } from "@/lib/trpc";
import { useSessions } from "@/components/sessions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import {
  ActionBarPrimitive,
  AttachmentPrimitive,
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowDown02Icon,
  Copy01Icon,
  IncognitoIcon,
  PencilEdit02Icon,
  Share08Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { type FC, memo, type ReactNode, useState } from "react";
import { z } from "zod";
import { Reply } from "@/components/answer";

const iconButton =
  "text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-40";

const ThreadImpl: FC = () => {
  return (
    <ThreadShell>
      <ThreadKeys />
      <ThreadPrimitive.Root className="bg-background text-foreground @container flex h-full flex-col print:h-auto">
        <AuiIf condition={(s) => s.thread.messages.length === 0}>
          <EmptyState />
        </AuiIf>

        <AuiIf condition={(s) => s.thread.messages.length > 0}>
          <ThreadPrimitive.Viewport className="flex grow flex-col overflow-y-auto print:overflow-visible">
            <TopBar />
            <ThreadBody />
          </ThreadPrimitive.Viewport>
        </AuiIf>
      </ThreadPrimitive.Root>
    </ThreadShell>
  );
};

export const Thread = memo(ThreadImpl);

export const EmptyThread: FC = () => (
  <main className="h-dvh">
    <ThreadShell>
      <div className="bg-background h-full" />
    </ThreadShell>
  </main>
);

const TurnRow: FC<{ children: ReactNode; layout?: "column" | "edge" }> = ({
  children,
  layout = "column",
}) => (layout === "edge" ? children : <div className="mx-auto w-full max-w-182">{children}</div>);

const TopBar: FC = () => {
  const bot = useBot();
  const t = useT();

  return (
    <div
      className={cn(
        "bg-background after:from-background sticky top-0 z-20 pe-6 ps-14 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-linear-to-b after:to-transparent print:hidden",
        bot ? "lg:ps-4" : "lg:ps-6",
      )}
    >
      <div className="absolute top-0 end-4 flex h-14 items-center">
        {bot ? <BotHeaderMenu /> : <HeaderActions />}
      </div>
      <TurnRow layout={bot ? "edge" : "column"}>
        <div className="flex h-14 items-center gap-4">
          <a href="/" aria-label={t("New chat")} className={cn(iconButton, "lg:hidden")}>
            <HugeiconsIcon icon={Add01Icon} className="size-4.5" />
          </a>
          <BotTitle />
        </div>
      </TurnRow>
    </div>
  );
};

const HeaderActions: FC = () => {
  const chat = useChatState();
  const t = useT();
  const [copied, setCopied] = useState(false);
  const published = useSessions(
    (s) => s.sessions?.find((session) => session.id === chat?.id)?.published === true,
  );

  const copy = (path: string) =>
    navigator.clipboard.writeText(`${window.location.origin}${path}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    });

  const publish = async (next: boolean) => {
    if (!chat?.saved) return;
    const done = await api.sessions.publish
      .mutate({ id: chat.id, published: next })
      .catch(() => undefined);
    if (!done) return;
    useSessions.setState((state) => ({
      sessions: state.sessions?.map((session) =>
        session.id === chat.id ? Object.assign({}, session, done) : session,
      ),
    }));
    if (done.published) await copy(`/p/${chat.id}`);
  };

  return (
    <div className="flex items-center gap-2">
      <IncognitoToggle />
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={!chat?.saved}
          aria-label={t("Share")}
          className="bg-foreground/10 hover:bg-foreground/15 data-[state=open]:bg-foreground/15 flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-[470] transition-colors disabled:opacity-40"
        >
          <Swap
            swapped={copied}
            from={<HugeiconsIcon icon={Share08Icon} className="size-4" />}
            to={<HugeiconsIcon icon={Tick02Icon} className="size-4" />}
          />
          <span className="hidden sm:inline">{copied ? t("Copied") : t("Share")}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem
            onSelect={() => void copy(`/c/${chat?.id ?? ""}`)}
            className="flex-col items-start gap-0"
          >
            <span>{t("Copy link")}</span>
            <span className="text-muted-foreground text-xs">{t("Only you can open it")}</span>
          </DropdownMenuItem>
          {published ? (
            <>
              <DropdownMenuItem onSelect={() => void copy(`/p/${chat?.id ?? ""}`)}>
                {t("Copy page link")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void publish(false)}>
                {t("Unpublish page")}
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem
              onSelect={() => void publish(true)}
              className="flex-col items-start gap-0"
            >
              <span>{t("Publish page")}</span>
              <span className="text-muted-foreground text-xs">
                {t("Anyone with the link can read it")}
              </span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const IncognitoToggle: FC = () => {
  const incognito = useChatOptions((s) => s.incognito);
  const setIncognito = useChatOptions((s) => s.setIncognito);
  const t = useT();

  return (
    <button
      type="button"
      aria-pressed={incognito}
      onClick={() => setIncognito(!incognito)}
      title={
        incognito
          ? t("Incognito is on: new messages aren't saved")
          : t("Use incognito: new messages aren't saved to your history")
      }
      className={cn(
        "text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 items-center gap-1.5 rounded-full px-2 text-sm transition-colors",
        incognito && "bg-super/15 text-super hover:text-super",
      )}
    >
      <HugeiconsIcon icon={IncognitoIcon} className="size-4" />
      {incognito && t("Incognito")}
    </button>
  );
};

const ThreadBody: FC = () => {
  const t = useT();
  const bot = useBot();
  const sourcesOpen = useOpenSources((s) => s.id !== undefined);
  const shifted = cn(
    "transition-all duration-300 ease-out-quint motion-reduce:transition-none",
    sourcesOpen && "@3xl:pe-90",
  );

  return (
    <>
      <div className={cn("px-6 pb-8", shifted)}>
        <TurnRow>
          <BotGreeting />
          <ThreadPrimitive.Messages>
            {() => (bot ? <BotTurn /> : <Turn />)}
          </ThreadPrimitive.Messages>
          <BotLearned />
        </TurnRow>
      </div>
      <ThreadPrimitive.ViewportFooter
        className={cn("bg-background sticky bottom-0 mt-auto px-6 pb-3 print:hidden", shifted)}
      >
        <TurnRow>
          <div className="relative">
            <ThreadPrimitive.ScrollToBottom
              behavior="smooth"
              className="bg-card border-border text-muted-foreground hover:text-foreground absolute -top-11 left-1/2 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border disabled:invisible"
            >
              <HugeiconsIcon icon={ArrowDown02Icon} className="size-4" />
            </ThreadPrimitive.ScrollToBottom>
            <Composer
              placeholder={bot ? t("Message {name}", { name: bot.name }) : t("Ask a follow-up")}
              menuSide="top"
              bot={!!bot}
              compact
            />
            <Caution />
          </div>
        </TurnRow>
      </ThreadPrimitive.ViewportFooter>
    </>
  );
};

const Caution: FC = () => {
  const t = useT();
  return (
    <p className="text-muted-foreground mt-2 text-center text-xs">
      {t("Sirathic can make mistakes. Check the sources.")}
    </p>
  );
};

const EmptyState: FC = () => {
  const t = useT();
  const bot = useBot();
  if (bot) return <BotHome bot={bot} />;
  return (
    <div className="relative flex h-full flex-col px-4 pb-5 md:justify-center md:px-6 md:pb-[16vh]">
      <div className="absolute top-3 end-4">
        <IncognitoToggle />
      </div>
      <div className="mx-auto flex w-full max-w-[640px] flex-col max-md:flex-1">
        <div className="mb-9 flex flex-col items-center gap-5 max-md:my-auto">
          <Mark size={26} color="currentColor" />
          <h1 className="px-4 text-center text-2xl tracking-[-0.02em] md:text-[26px]">
            {t("What do you want to know?")}
          </h1>
        </div>
        <Composer placeholder={t("Ask anything…")} menuSide="bottom" rotate />
        <Caution />
      </div>
    </div>
  );
};

const Turn: FC = () => {
  const role = useAuiState((s) => s.message.role);

  return (
    <MessagePrimitive.Root className="group/message">
      {role === "user" ? <Question /> : role === "assistant" ? <Reply /> : null}
    </MessagePrimitive.Root>
  );
};

const routineOf = z.object({ routine: z.string() });

const Question: FC = () => {
  const t = useT();
  const routine = useAuiState((s) => routineOf.safeParse(s.message.metadata.custom).data?.routine);
  if (routine) {
    return (
      <p className="text-muted-foreground pt-8 pb-2 text-xs">
        {t("Routine")} · {routine}
      </p>
    );
  }
  return (
    <>
      <AuiIf condition={(s) => !s.message.composer.isEditing}>
        <div className="flex w-full items-start justify-end gap-1 pt-8 pb-6">
          <ActionBarPrimitive.Root className="mt-2.5 flex opacity-0 group-focus-within/message:opacity-100 group-hover/message:opacity-100 pointer-coarse:mt-1.5 pointer-coarse:opacity-100 print:hidden">
            <ActionBarPrimitive.Edit
              className={cn(iconButton, "size-6 pointer-coarse:size-9")}
              aria-label={t("Edit query")}
            >
              <HugeiconsIcon icon={PencilEdit02Icon} className="size-3" />
            </ActionBarPrimitive.Edit>
            <ActionBarPrimitive.Copy
              className={cn(iconButton, "size-6 pointer-coarse:size-9")}
              aria-label={t("Copy query")}
            >
              <HugeiconsIcon icon={Copy01Icon} className="size-3" />
            </ActionBarPrimitive.Copy>
          </ActionBarPrimitive.Root>
          <div className="flex max-w-[90%] min-w-0 flex-col items-end gap-2">
            <AuiIf condition={(s) => !!s.message.attachments?.length}>
              <div className="flex flex-wrap justify-end gap-2">
                <MessagePrimitive.Attachments>
                  {() => (
                    <AttachmentPrimitive.Root>
                      <AttachmentChip />
                    </AttachmentPrimitive.Root>
                  )}
                </MessagePrimitive.Attachments>
              </div>
            </AuiIf>
            <div className="bg-bubble max-w-full overflow-x-auto rounded-2xl px-4 py-2 text-[15px] leading-[22.5px] wrap-break-word whitespace-pre-wrap">
              <MessagePrimitive.Parts
                components={{
                  Text: UserText,
                }}
              />
            </div>
          </div>
        </div>
      </AuiIf>
      <AuiIf condition={(s) => s.message.composer.isEditing}>
        <ComposerPrimitive.Root
          ref={(form) => {
            requestAnimationFrame(() =>
              requestAnimationFrame(() => form?.scrollIntoView({ block: "nearest" })),
            );
          }}
          className="bg-card my-6 flex flex-col gap-2 rounded-2xl p-3"
        >
          <ComposerPrimitive.Input
            autoFocus
            className="w-full resize-none bg-transparent px-2 pt-1 text-base outline-none"
          />
          <div className="flex justify-end gap-2">
            <ComposerPrimitive.Cancel className="hover:bg-muted h-8 rounded-lg px-3 text-sm">
              {t("Cancel")}
            </ComposerPrimitive.Cancel>
            <ComposerPrimitive.Send className="bg-primary text-primary-foreground h-8 rounded-lg px-3 text-sm">
              {t("Save")}
            </ComposerPrimitive.Send>
          </div>
        </ComposerPrimitive.Root>
      </AuiIf>
    </>
  );
};
