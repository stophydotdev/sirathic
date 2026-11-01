"use client";

import { useChatOptions } from "@/components/chatOptions";
import { AttachmentChip, Composer } from "@/components/composer";
import { useT } from "@/components/i18n";
import { Mark } from "@/components/logo";
import { useNewChatClick } from "@/components/newChat";
import { UserText } from "@/components/mentions";
import { useOpenSources } from "@/components/openSources";
import { BotTurn, GroupTyping } from "@/components/botChat";
import { GroupHome, GroupTitle, useGroup } from "@/components/groupHome";
import { BotGreeting, BotHeaderMenu, BotHome, BotTitle, useBot } from "@/components/botHome";
import { BotLearned } from "@/components/botLearned";
import { ThreadKeys } from "@/components/shortcuts";
import { ThreadShell } from "@/components/threadShell";
import { Swap } from "@/components/swap";
import { cn } from "@/lib/utils";
import { ShareMenu } from "@/components/shareMenu";
import { LinksView } from "@/components/linksView";
import { useThreadView } from "@/components/threadView";
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
  Globe02Icon,
  IncognitoIcon,
  PencilEdit02Icon,
  Share08Icon,
  TextAlignLeftIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { type FC, memo, type ReactNode, useEffect } from "react";
import { z } from "zod";
import { Reply } from "@/components/answer";

const iconButton =
  "text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-40";

const ThreadImpl: FC = () => {
  const view = useThreadView((s) => s.view);

  return (
    <ThreadShell>
      <ThreadKeys />
      <ThreadPrimitive.Root className="bg-background text-foreground @container flex h-full flex-col print:h-auto">
        <AuiIf condition={(s) => s.thread.messages.length === 0}>
          <EmptyState />
        </AuiIf>

        <AuiIf condition={(s) => s.thread.messages.length > 0}>
          <ThreadPrimitive.Viewport
            autoScroll={view === "answer"}
            className="flex grow flex-col overflow-y-auto print:overflow-visible"
          >
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
  const group = useGroup();
  const t = useT();
  const newChatClick = useNewChatClick();

  return (
    <div
      className={cn(
        "bg-background after:from-background sticky top-0 z-20 pe-6 ps-14 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-linear-to-b after:to-transparent print:hidden",
        bot || group ? "lg:ps-4" : "lg:ps-6",
      )}
    >
      <div className="absolute top-0 end-4 flex h-14 items-center">
        {bot ? <BotHeaderMenu /> : group ? null : <HeaderActions />}
      </div>
      <TurnRow layout={bot || group ? "edge" : "column"}>
        <div className="flex h-14 items-center gap-4">
          <Link
            href="/"
            onClick={newChatClick}
            aria-label={t("New chat")}
            className={cn(iconButton, "lg:hidden")}
          >
            <HugeiconsIcon icon={Add01Icon} className="size-4.5" />
          </Link>
          <BotTitle />
          {group && <GroupTitle group={group} />}
          {!bot && !group && <ViewTabs />}
        </div>
      </TurnRow>
    </div>
  );
};

const HeaderActions: FC = () => {
  const t = useT();

  return (
    <div className="flex items-center gap-2">
      <IncognitoToggle />
      <ShareMenu className="bg-foreground/10 hover:bg-foreground/15 data-[state=open]:bg-foreground/15 flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-[470] transition-colors disabled:opacity-40">
        {(copied) => (
          <>
            <Swap
              swapped={copied}
              from={<HugeiconsIcon icon={Share08Icon} className="size-4" />}
              to={<HugeiconsIcon icon={Tick02Icon} className="size-4" />}
            />
            <span className="hidden sm:inline">{copied ? t("Copied") : t("Share")}</span>
          </>
        )}
      </ShareMenu>
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

const VIEWS = [
  { view: "answer", label: "Answer", icon: TextAlignLeftIcon },
  { view: "links", label: "Links", icon: Globe02Icon },
] as const;

const ViewTabs: FC = () => {
  const view = useThreadView((s) => s.view);
  const t = useT();
  useEffect(() => () => useThreadView.setState({ view: "answer" }), []);

  return (
    <div role="tablist" className="flex h-14 items-stretch gap-5">
      {VIEWS.map((tab) => (
        <button
          key={tab.view}
          type="button"
          role="tab"
          aria-selected={view === tab.view}
          aria-label={t(tab.label)}
          onClick={() => useThreadView.setState({ view: tab.view })}
          className="text-muted-foreground hover:text-foreground aria-selected:text-foreground aria-selected:border-foreground flex items-center gap-1.5 border-b-2 border-transparent text-sm font-medium"
        >
          <HugeiconsIcon icon={tab.icon} className="size-4" />
          <span className="max-sm:hidden">{t(tab.label)}</span>
        </button>
      ))}
    </div>
  );
};

const ThreadBody: FC = () => {
  const t = useT();
  const bot = useBot();
  const group = useGroup();
  const sourcesOpen = useOpenSources((s) => s.id !== undefined);
  const view = useThreadView((s) => s.view);
  const shifted = cn(
    "transition-all duration-300 ease-out-quint motion-reduce:transition-none",
    sourcesOpen && "@3xl:pe-90",
  );

  return (
    <>
      <div className={cn("px-6 pb-8", shifted)}>
        <TurnRow>
          <BotGreeting />
          {view === "links" && !bot && !group ? (
            <LinksView />
          ) : (
            <ThreadPrimitive.Messages>
              {() => (bot || group ? <BotTurn /> : <Turn />)}
            </ThreadPrimitive.Messages>
          )}
          {group && <GroupTyping />}
          <BotLearned />
        </TurnRow>
      </div>
      <ThreadPrimitive.ViewportFooter
        className={cn("bg-background sticky bottom-0 mt-auto px-6 pb-3 print:hidden", shifted)}
      >
        <TurnRow>
          <div className="relative">
            {view === "answer" && (
              <ThreadPrimitive.ScrollToBottom
                behavior="smooth"
                className="bg-card border-border text-muted-foreground hover:text-foreground absolute -top-11 left-1/2 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border disabled:invisible"
              >
                <HugeiconsIcon icon={ArrowDown02Icon} className="size-4" />
              </ThreadPrimitive.ScrollToBottom>
            )}
            <Composer
              placeholder={
                bot || group
                  ? t("Message {name}", { name: (bot ?? group)?.name ?? "" })
                  : t("Ask a follow-up")
              }
              menuSide="top"
              bot={!!bot || !!group}
              compact
            />
          </div>
        </TurnRow>
      </ThreadPrimitive.ViewportFooter>
    </>
  );
};

const EmptyState: FC = () => {
  const t = useT();
  const bot = useBot();
  const group = useGroup();
  if (bot) return <BotHome bot={bot} />;
  if (group) return <GroupHome group={group} />;
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
