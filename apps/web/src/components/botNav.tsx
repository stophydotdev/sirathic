"use client";

import { useAccount } from "@/components/account";
import { BotAvatar } from "@/components/botAvatar";
import { botGroups, SIDEBAR_LIMIT } from "@/components/botGroups";
import { BotMenu } from "@/components/botMenu";
import { BotSettings } from "@/components/botSettings";
import { useT } from "@/components/i18n";
import { type Project, useProjects } from "@/components/projects";
import { useSessions } from "@/components/sessions";
import { cn } from "@/lib/utils";
import { IconChevronDown, IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type FC, useState } from "react";

const BotRow: FC<{ bot: Project; onDone?: () => void }> = ({ bot, onDone }) => {
  const pathname = usePathname();
  const unread = useSessions((s) => s.sessions?.find((found) => found.id === bot.id)?.unread);
  const [menu, setMenu] = useState(false);
  const href = `/bot/${bot.id}`;

  return (
    <div
      onContextMenu={(event) => {
        event.preventDefault();
        setMenu(true);
      }}
      className={cn(
        "group/bot hover:bg-muted flex items-center gap-0.5 rounded-[12px] pe-2",
        (pathname === href || menu) && "bg-muted",
      )}
    >
      <Link
        href={href}
        onClick={onDone}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-1.5"
      >
        <BotAvatar color={bot.color} icon={bot.symbol} className="size-7" />
        <span
          className={cn("text-foreground min-w-0 flex-1 truncate text-sm", unread && "font-[560]")}
        >
          {bot.name}
        </span>
      </Link>
      {unread && (
        <span className="bg-super me-2 size-1.5 shrink-0 rounded-full group-focus-within/bot:hidden group-hover/bot:hidden group-has-[[data-state=open]]/bot:hidden" />
      )}
      <BotMenu
        bot={bot}
        open={menu}
        onOpenChange={setMenu}
        className="text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-foreground/10 hidden size-5 shrink-0 items-center justify-center rounded-md group-focus-within/bot:flex group-hover/bot:flex data-[state=open]:flex pointer-coarse:flex"
      />
    </div>
  );
};

const toggleLink = "text-muted-foreground hover:text-foreground ps-2.5 text-start text-xs";

export const BotList: FC<{ onDone?: () => void }> = ({ onDone }) => {
  const signedIn = useAccount((s) => s.status?.signedIn === true);
  const bots = useProjects((s) => s.bots);
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [all, setAll] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [creating, setCreating] = useState(false);
  const t = useT();

  if (!signedIn) return null;

  const { groups, more, hidden } = botGroups(bots ?? [], all ? Infinity : SIDEBAR_LIMIT);

  return (
    <>
      <div className="text-muted-foreground flex items-center gap-1 ps-2.5 pt-6 pb-1 text-sm">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="group/bots hover:text-foreground flex min-w-0 flex-1 items-center gap-1 text-start"
        >
          {t("Bots")}
          <IconChevronDown
            className={cn(
              "size-3.5 opacity-0 transition-opacity group-hover/sidebar:opacity-100 group-focus-visible/bots:opacity-100 pointer-coarse:opacity-100",
              !open && "-rotate-90 opacity-100",
            )}
          />
        </button>
        <button
          type="button"
          aria-label={t("New bot")}
          title={t("New bot")}
          onClick={() => setCreating(true)}
          className="hover:bg-muted hover:text-foreground flex size-5 items-center justify-center rounded-md opacity-0 transition-opacity group-hover/sidebar:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
        >
          <IconPlus className="size-3.5" />
        </button>
      </div>
      {open && (
        <>
          {groups.map((group) => (
            <div
              key={group.kind === "section" ? `section:${group.name}` : group.kind}
              className="flex flex-col not-first:pt-2"
            >
              {group.kind === "pinned" && (
                <p className="text-muted-foreground ps-2.5 pt-1 pb-0.5 text-xs">{t("Pinned")}</p>
              )}
              {group.kind === "section" && (
                <p className="text-muted-foreground truncate ps-2.5 pt-1 pb-0.5 text-xs">
                  {group.name}
                </p>
              )}
              {group.bots.map((bot) => (
                <BotRow key={bot.id} bot={bot} onDone={onDone} />
              ))}
            </div>
          ))}
          {more > 0 && !all && (
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
              {showHidden && hidden.map((bot) => <BotRow key={bot.id} bot={bot} onDone={onDone} />)}
            </>
          )}
        </>
      )}
      {creating && (
        <BotSettings
          onClose={() => setCreating(false)}
          onCreated={(bot) => {
            setCreating(false);
            onDone?.();
            router.push(`/bot/${bot.id}`);
          }}
        />
      )}
    </>
  );
};
