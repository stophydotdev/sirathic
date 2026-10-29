"use client";

import { useAccount } from "@/components/account";
import { BotAvatar } from "@/components/botAvatar";
import { prefetchChat } from "@/components/chat";
import { botGroups, botLabel, SIDEBAR_LIMIT } from "@sirathic/app/botGroups";
import { BotMenu } from "@/components/botMenu";
import { BotSwitcher } from "@/components/botSwitcher";
import { whenOf } from "@/components/botTime";
import { useLocale, useT } from "@/components/i18n";
import { type Project, useProjects } from "@/components/projects";
import { useSessions } from "@/components/sessions";
import { Fold } from "@/components/fold";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type FC, useEffect, useState } from "react";

const BotRow: FC<{ bot: Project; onDone?: () => void }> = ({ bot, onDone }) => {
  const pathname = usePathname();
  const session = useSessions((s) => s.sessions?.find((found) => found.id === bot.id));
  const [menu, setMenu] = useState(false);
  const locale = useLocale();
  const t = useT();
  const href = `/bot/${bot.id}`;
  const unread = session?.unread;
  const preview = session ? session.preview : bot.greeting;

  return (
    <div
      onContextMenu={(event) => {
        event.preventDefault();
        setMenu(true);
      }}
      data-row
      data-active={pathname === href || undefined}
      className={cn(
        "group/bot hover:bg-muted relative flex items-center rounded-xl transition-colors",
        menu && "bg-muted",
      )}
    >
      <Link
        href={href}
        onClick={onDone}
        onPointerEnter={() => prefetchChat(bot.id)}
        onFocus={() => prefetchChat(bot.id)}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2"
      >
        <span className="relative shrink-0">
          <BotAvatar
            color={bot.color}
            body={bot.symbol}
            seed={bot.id}
            state={bot.hidden ? "paused" : session?.working ? "thinking" : "ready"}
            className="size-9"
          />
          {session?.working && (
            <span role="status" className="sr-only">
              {t("Working")}
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                "text-foreground min-w-0 flex-1 truncate text-sm",
                unread && "font-medium",
              )}
            >
              {botLabel(bot)}
            </span>
            {session && (
              <time className="text-muted-foreground shrink-0 text-xs group-focus-within/bot:invisible group-hover/bot:invisible group-has-[[data-state=open]]/bot:invisible pointer-coarse:visible">
                {whenOf(locale, session.updatedAt)}
              </time>
            )}
          </span>
          <span className="flex items-center gap-2 pointer-coarse:pe-6">
            <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{preview}</span>
            {unread && <span className="bg-super size-1.5 shrink-0 rounded-full" />}
          </span>
        </span>
      </Link>
      <BotMenu
        bot={bot}
        open={menu}
        onOpenChange={setMenu}
        onDone={onDone}
        className="text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-foreground/10 absolute end-2 top-2 hidden size-5 items-center justify-center rounded-md group-focus-within/bot:flex group-hover/bot:flex data-[state=open]:flex pointer-coarse:top-auto pointer-coarse:bottom-2 pointer-coarse:flex"
      />
    </div>
  );
};

const WORKING_POLL_MS = 10_000;

const toggleLink =
  "text-muted-foreground hover:text-foreground ps-2.5 text-start text-xs transition-colors";

export const BotList: FC<{ onDone?: () => void }> = ({ onDone }) => {
  const signedIn = useAccount((s) => s.status?.signedIn === true);
  const bots = useProjects((s) => s.bots);
  const anyWorking = useSessions((s) => s.sessions?.some((session) => session.working));
  const [open, setOpen] = useState(true);
  const [all, setAll] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [picking, setPicking] = useState(false);
  const t = useT();

  useEffect(() => {
    if (!anyWorking) return;
    const timer = setInterval(() => void useSessions.getState().refresh(), WORKING_POLL_MS);
    return () => clearInterval(timer);
  }, [anyWorking]);

  if (!signedIn) return null;

  const { groups, hidden } = botGroups(bots ?? [], Infinity);
  const limited = botGroups(bots ?? [], SIDEBAR_LIMIT);
  const kept = new Set(limited.groups.flatMap((group) => group.bots));

  return (
    <>
      <div className="text-muted-foreground flex items-center gap-1 ps-2.5 pt-6 pb-1 text-sm">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="group/bots hover:text-foreground flex min-w-0 flex-1 items-center gap-1 text-start transition-colors"
        >
          {t("Bots")}
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            className={cn(
              "size-3.5 opacity-0 transition-transform duration-300 ease-out-quint group-hover/sidebar:opacity-100 group-focus-visible/bots:opacity-100 motion-reduce:transition-none pointer-coarse:opacity-100",
              !open && "-rotate-90 opacity-100",
            )}
          />
        </button>
        <button
          type="button"
          aria-label={t("Search or create bots")}
          title={t("Search or create bots")}
          onClick={() => setPicking(true)}
          className="hover:bg-muted hover:text-foreground flex size-5 items-center justify-center rounded-md opacity-0 group-hover/sidebar:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
        >
          <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
        </button>
      </div>
      <Fold open={open} className="gap-0.5">
        {groups.map((group, index) => {
          const extra = group.bots.filter((bot) => !kept.has(bot));
          const block = (
            <div className={cn("flex flex-col", index > 0 && "pt-2")}>
              {group.kind === "pinned" && (
                <p className="text-muted-foreground ps-2.5 pt-1 pb-0.5 text-xs">{t("Pinned")}</p>
              )}
              {group.kind === "section" && (
                <p className="text-muted-foreground truncate ps-2.5 pt-1 pb-0.5 text-xs">
                  {group.name}
                </p>
              )}
              {group.bots
                .filter((bot) => kept.has(bot))
                .map((bot) => (
                  <BotRow key={bot.id} bot={bot} onDone={onDone} />
                ))}
              {extra.length > 0 && extra.length < group.bots.length && (
                <Fold open={all}>
                  {extra.map((bot) => (
                    <BotRow key={bot.id} bot={bot} onDone={onDone} />
                  ))}
                </Fold>
              )}
            </div>
          );
          const key = group.kind === "section" ? `section:${group.name}` : group.kind;
          return extra.length === group.bots.length ? (
            <Fold key={key} open={all}>
              {block}
            </Fold>
          ) : (
            <div key={key}>{block}</div>
          );
        })}
        {limited.more > 0 && !all && (
          <button type="button" onClick={() => setAll(true)} className={toggleLink}>
            {t("Show more")}
          </button>
        )}
        {hidden.length > 0 && (
          <>
            <button
              type="button"
              aria-expanded={showHidden}
              onClick={() => setShowHidden(!showHidden)}
              className={cn(toggleLink, "pt-2")}
            >
              {t("Hidden bots")} ({hidden.length})
            </button>
            <Fold open={showHidden} className="gap-0.5">
              {hidden.map((bot) => (
                <BotRow key={bot.id} bot={bot} onDone={onDone} />
              ))}
            </Fold>
          </>
        )}
      </Fold>
      <BotSwitcher open={picking} onOpenChange={setPicking} onDone={onDone} />
    </>
  );
};
