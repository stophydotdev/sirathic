"use client";

import { useChatState } from "@/components/chat";
import { useProjects } from "@/components/projects";
import { useSessions } from "@/components/sessions";
import { useChatOptions } from "@/components/chatOptions";
import { AttachmentChip, Composer } from "@/components/composer";
import { ExportMenu } from "@/components/exportChat";
import { Favicon, FaviconStack } from "@/components/favicon";
import { groupsOf, KIND_NAMES, siteName, turnsOf } from "@/components/sources";
import { useT } from "@/components/i18n";
import { Mark } from "@/components/logo";
import { SirathicIcon } from "@/components/makerIcon";
import { UserText } from "@/components/mentions";
import { ProjectHome } from "@/components/projectHome";
import { BotTurn } from "@/components/botChat";
import { BotGreeting, BotHeaderMenu, BotHome, BotTitle, useBot } from "@/components/botHome";
import { BotLearned } from "@/components/botLearned";
import { ThreadKeys } from "@/components/shortcuts";
import { ThreadImages } from "@/components/threadMedia";
import { ThreadShell } from "@/components/threadShell";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/messages/en";
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
  ArrowRight01Icon,
  Copy01Icon,
  Globe02Icon,
  Image01Icon,
  IncognitoIcon,
  PencilEdit02Icon,
  Share08Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { type FC, memo, type ReactNode, useEffect, useState } from "react";
import { z } from "zod";
import { create } from "zustand";
import { Reply, ThreadLinks } from "@/components/answer";

const iconButton =
  "text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-40";

const TABS = [
  { id: "answer", name: "Answer", icon: <SirathicIcon className="size-4" /> },
  { id: "links", name: "Links", icon: <HugeiconsIcon icon={Globe02Icon} className="size-4" /> },
  { id: "images", name: "Images", icon: <HugeiconsIcon icon={Image01Icon} className="size-4" /> },
] as const satisfies readonly {
  id: string;
  name: MessageKey;
  icon: ReactNode;
}[];

type Tab = (typeof TABS)[number]["id"];

const useThreadTab = create<{ tab: Tab; open: (tab: Tab) => void }>()((set) => ({
  tab: "answer",
  open: (tab) => set({ tab }),
}));

const ThreadImpl: FC = () => {
  const threadId = useAuiState((s) => s.threads.mainThreadId);
  useEffect(() => {
    useThreadTab.getState().open("answer");
  }, [threadId]);

  return (
    <ThreadShell>
      <ThreadKeys />
      <ThreadPrimitive.Root className="bg-background text-foreground flex h-full flex-col print:h-auto">
        <AuiIf condition={(s) => s.thread.messages.length === 0}>
          <EmptyState />
        </AuiIf>

        <AuiIf condition={(s) => s.thread.messages.length > 0}>
          <ThreadPrimitive.Viewport className="flex grow flex-col overflow-y-auto print:overflow-visible">
            <TabBar />
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

const TurnRow: FC<{
  children: ReactNode;
  aside?: ReactNode;
  layout?: "aside" | "column" | "edge";
}> = ({ children, aside, layout = "aside" }) => {
  if (layout === "edge") return children;
  if (layout === "column") return <div className="mx-auto w-full max-w-182">{children}</div>;
  return (
    <div className="mx-auto grid w-full max-w-[720px] xl:max-w-none xl:grid-cols-[minmax(0,720px)_320px] xl:justify-between xl:ps-[35px]">
      <div className="min-w-0">{children}</div>
      {aside && (
        <aside className="hidden xl:block">
          <div className="sticky top-14 pt-4">{aside}</div>
        </aside>
      )}
    </div>
  );
};

const TabBar: FC = () => {
  const tab = useThreadTab((s) => s.tab);
  const open = useThreadTab((s) => s.open);
  const bot = useBot();
  const t = useT();

  return (
    <div
      className={cn(
        "bg-background sticky top-0 z-20 pe-6 ps-14 print:hidden",
        bot ? "lg:ps-4" : "lg:ps-6",
        bot
          ? "after:from-background after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-linear-to-b after:to-transparent"
          : "border-border/50 border-b",
      )}
    >
      <div className="absolute top-0 end-4 flex h-14 items-center">
        {bot ? <BotHeaderMenu /> : <HeaderActions />}
      </div>
      <TurnRow layout={bot ? "edge" : "aside"}>
        <div className="flex h-14 items-center gap-4">
          <a href="/" aria-label={t("New chat")} className={cn(iconButton, "lg:hidden")}>
            <HugeiconsIcon icon={Add01Icon} className="size-4.5" />
          </a>
          <BotTitle />
          {!bot && (
            <div role="tablist" className="flex h-full gap-5">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => open(item.id)}
                  className={cn(
                    "-mb-px flex items-center gap-1.5 border-b-2 text-sm font-[470] transition-colors",
                    tab === item.id
                      ? "border-foreground text-foreground"
                      : "text-muted-foreground hover:text-foreground border-transparent",
                  )}
                >
                  {item.icon}
                  <span className="max-sm:sr-only">{t(item.name)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </TurnRow>
    </div>
  );
};

const timeOf = z.object({ createdAt: z.number() });

const HeaderActions: FC = () => {
  const chat = useChatState();
  const t = useT();
  const createdAt = useAuiState((s) => {
    const last = s.thread.messages.findLast((message) => message.role === "assistant");
    return timeOf.safeParse(last?.metadata.custom).data?.createdAt;
  });
  const [copied, setCopied] = useState(false);

  const share = () => {
    if (!chat?.saved) return;
    void navigator.clipboard.writeText(`${window.location.origin}/c/${chat.id}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    });
  };

  return (
    <div className="flex items-center gap-2">
      {createdAt !== undefined && (
        <span className="text-muted-foreground hidden text-xs tabular-nums sm:inline">
          {new Date(createdAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      )}
      <IncognitoToggle />
      <ExportMenu
        onPrint={() => {
          useThreadTab.getState().open("answer");
          setTimeout(() => window.print(), 100);
        }}
      />
      <button
        type="button"
        onClick={share}
        disabled={!chat?.saved}
        title={t("Copy a link to this chat")}
        className="bg-foreground/10 hover:bg-foreground/15 flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-[470] transition-colors disabled:opacity-40"
      >
        {copied ? (
          <HugeiconsIcon icon={Tick02Icon} className="size-4" />
        ) : (
          <HugeiconsIcon icon={Share08Icon} className="size-4" />
        )}
        <span className="hidden sm:inline">{copied ? t("Copied") : t("Share")}</span>
      </button>
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
  const tab = useThreadTab((s) => s.tab);
  const t = useT();
  const chat = useChatState();
  const session = useSessions((s) => s.sessions?.find((found) => found.id === chat?.id));
  const changeSession = useSessions((s) => s.change);
  const projectId = session ? session.projectId : chat?.projectId;
  const project = useProjects((s) => s.projects?.find((found) => found.id === projectId));
  const bot = useBot();
  if (!bot && tab === "links") return <ThreadLinks />;
  if (!bot && tab === "images") return <ThreadImages />;

  return (
    <>
      <div className="px-6 pb-8">
        <TurnRow aside={bot ? undefined : <SourcesPane />} layout={bot ? "column" : "aside"}>
          <BotGreeting />
          <ThreadPrimitive.Messages>
            {() => (bot ? <BotTurn /> : <Turn />)}
          </ThreadPrimitive.Messages>
          <BotLearned />
        </TurnRow>
      </div>
      <ThreadPrimitive.ViewportFooter className="bg-background sticky bottom-0 mt-auto px-6 pb-3 print:hidden">
        <TurnRow layout={bot ? "column" : "aside"}>
          <div className="relative">
            <ThreadPrimitive.ScrollToBottom className="bg-card border-border text-muted-foreground hover:text-foreground absolute -top-11 left-1/2 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border disabled:invisible">
              <HugeiconsIcon icon={ArrowDown02Icon} className="size-4" />
            </ThreadPrimitive.ScrollToBottom>
            <Composer
              placeholder={bot ? t("Message {name}", { name: bot.name }) : t("Ask a follow-up")}
              menuSide="top"
              bot={!!bot}
              compact
              project={
                project && chat
                  ? {
                      id: project.id,
                      name: project.name,
                      icon: project.icon,
                      leaveLabel: t("Remove from project"),
                      onLeave: () => void changeSession(chat.id, { projectId: null }),
                    }
                  : undefined
              }
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
  const projectId = useChatState()?.projectId;
  const bot = useBot();
  if (bot) return <BotHome bot={bot} />;
  if (projectId) return <ProjectHome id={projectId} />;
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
          <ActionBarPrimitive.Root className="mt-2.5 flex opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100 pointer-coarse:mt-1.5 pointer-coarse:opacity-100 print:hidden">
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
            <div className="bg-foreground/3 max-w-full overflow-x-auto rounded-2xl px-4 py-2 text-[15px] leading-[22.5px] wrap-break-word whitespace-pre-wrap">
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

const ARABIC = /^\P{L}*\p{Script=Arabic}/u;

const SourcesPane: FC = () => {
  const messages = useAuiState((s) => s.thread.messages);
  const t = useT();
  const [chosen, setChosen] = useState<boolean>();
  const open = chosen ?? true;
  const turns = turnsOf(messages).filter((turn) => turn.sources.length > 0);
  const urls = [...new Set(turns.flatMap((turn) => turn.sources.map((s) => s.url)))];
  if (urls.length === 0) return null;

  return (
    <div className="bg-card border-foreground/8 overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={() => setChosen(!open)}
        className="flex w-full items-center gap-2 py-3 pe-2 ps-3"
      >
        <span className="text-muted-foreground flex-1 text-start text-sm">{t("Sources")}</span>
        {!open && <FaviconStack urls={urls} />}
        <span className="text-muted-foreground flex items-center gap-1 text-sm tabular-nums">
          {!open && urls.length}
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className={cn(
              "size-4 transition-transform rtl:rotate-180",
              open && "rotate-90 rtl:rotate-90",
            )}
          />
        </span>
      </button>
      {open && (
        <div className="flex max-h-[min(28rem,calc(100dvh-12rem))] flex-col gap-1 overflow-y-auto px-2 pb-2">
          {turns.map((turn) => {
            const groups = groupsOf(turn.sources);
            return (
              <section key={turn.id} className="flex flex-col gap-1">
                {turns.length > 1 && (
                  <p className="text-muted-foreground truncate px-2 pt-2 text-xs">
                    Results for “{turn.question}”
                  </p>
                )}
                <p className="text-muted-foreground px-2 pt-1 text-xs tabular-nums">
                  {groups
                    .map((group) => `${t(KIND_NAMES[group.kind])} ${group.sources.length}`)
                    .join(" · ")}
                </p>
                {groups.map((group) => (
                  <div key={group.kind} className="flex flex-col gap-1">
                    <p className="text-foreground px-2 pt-3 text-xs font-medium">
                      {t(KIND_NAMES[group.kind])}
                    </p>
                    {group.sources.map((source) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:bg-muted flex gap-2 rounded-xl p-2 text-sm"
                      >
                        <Favicon url={source.url} size={16} className="mt-0.5" />
                        <span className="flex min-w-0 flex-col">
                          <span className="text-muted-foreground line-clamp-1 text-xs">
                            {siteName(source.url)}
                          </span>
                          <span
                            className={cn(
                              "line-clamp-2",
                              ARABIC.test(source.title) && "leading-relaxed",
                            )}
                          >
                            {source.title}
                          </span>
                          {source.snippet && (
                            <span
                              dir="auto"
                              className={cn(
                                "text-muted-foreground line-clamp-4",
                                ARABIC.test(source.snippet) && "leading-loose",
                              )}
                            >
                              {source.snippet}
                            </span>
                          )}
                          {source.credit && (
                            <span className="text-muted-foreground text-xs">{source.credit}</span>
                          )}
                        </span>
                      </a>
                    ))}
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
