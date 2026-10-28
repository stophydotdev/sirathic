"use client";

import { useAccount } from "@/components/account";
import { AutomationsIcon, UnseenDot, useUnseenRuns } from "@/components/automationAlerts";
import { useChatOptions } from "@/components/chatOptions";
import { useLocale, useT } from "@/components/i18n";
import { isRtl } from "@/components/locales";
import { Mark } from "@/components/logo";
import { useProjects } from "@/components/projects";
import { useBot } from "@/components/botHome";
import { BotList } from "@/components/botNav";
import { BotPanel } from "@/components/botSettings";
import { SearchDialog, SessionRow } from "@/components/sessionMenu";
import { useSessions } from "@/components/sessions";
import { SettingsDialog, useSettings } from "@/components/settings";
import { AccountRow, SignInDialog } from "@/components/signIn";
import { TooltipIconButton } from "@/components/tooltipIconButton";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AskSelection } from "@/components/askSelection";
import { useStartChat } from "@/components/newChat";
import { ShortcutsSheet, useShortcuts } from "@/components/shortcuts";
import { useKeyNames, withMod } from "@/lib/keys";
import { Fold } from "@/components/fold";
import { TabPill } from "@/components/tabLink";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowDown01Icon,
  AtIcon,
  LibraryIcon,
  Menu01Icon,
  Search01Icon,
  SidebarLeftIcon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { type FC, type ReactNode, useEffect, useState } from "react";

export const ThreadShell: FC<{ children: ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const t = useT();
  const rtl = isRtl(useLocale());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const keys = useKeyNames();
  const unseenRuns = useUnseenRuns(useAccount((s) => s.status?.signedIn));
  const bot = useBot();
  const startChat = useStartChat();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!withMod(event)) return;
      if (event.code === "KeyI" && !event.shiftKey) {
        event.preventDefault();
        startChat();
      } else if (event.code === "KeyK" && !event.shiftKey) {
        event.preventDefault();
        setSearching(true);
      } else if (event.code === "KeyS" && event.shiftKey) {
        event.preventDefault();
        if (matchMedia("(min-width: 1024px)").matches) setCollapsed((open) => !open);
        else setMobileOpen((open) => !open);
      } else if (event.key === "/" || event.code === "Slash") {
        event.preventDefault();
        useShortcuts.getState().setOpen(true);
      } else if (event.code === "Semicolon") {
        event.preventDefault();
        const { incognito, setIncognito } = useChatOptions.getState();
        setIncognito(!incognito);
      } else if (event.code === "Comma" && event.shiftKey) {
        event.preventDefault();
        useSettings.getState().show();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navRow = "h-10 gap-2.75 overflow-hidden rounded-lg px-2.5 text-base has-[>svg]:px-2.5";
  const label = "min-w-0 flex-1 overflow-hidden whitespace-nowrap";
  const mobileRow = "h-8 gap-2 rounded-md px-2.5 text-sm";

  return (
    <div className="relative flex h-full w-full overflow-hidden print:h-auto print:overflow-visible">
      <aside
        className={cn(
          "group/sidebar bg-side border-sidebar-border hidden h-full shrink-0 flex-col overflow-hidden border-e transition-[width] duration-300 ease-out-quint lg:flex motion-reduce:transition-none print:hidden",
          collapsed ? "w-14" : "w-64",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-2">
          {!collapsed && (
            <a
              href="/"
              className="text-foreground me-auto flex size-10 items-center justify-center"
            >
              <Mark size={20} color="currentColor" />
            </a>
          )}
          {!collapsed && (
            <TooltipIconButton
              variant="ghost"
              size="icon"
              tooltip={t("Search chats")}
              side="bottom"
              onClick={() => setSearching(true)}
              className="text-muted-foreground hover:text-foreground size-8 rounded-full"
            >
              <HugeiconsIcon icon={Search01Icon} className="size-4" />
            </TooltipIconButton>
          )}
          <TooltipIconButton
            variant="ghost"
            size="icon"
            tooltip={collapsed ? t("Expand sidebar") : t("Collapse sidebar")}
            side={rtl ? "left" : "right"}
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "group/toggle text-muted-foreground hover:text-foreground mx-1 size-8 rounded-full",
              collapsed && "text-foreground",
            )}
          >
            {collapsed && (
              <span
                aria-hidden
                className="group-hover/toggle:hidden group-focus-visible/toggle:hidden"
              >
                <Mark size={20} color="currentColor" />
              </span>
            )}
            <HugeiconsIcon
              icon={SidebarLeftIcon}
              className={cn(
                "size-4",
                collapsed && "hidden group-hover/toggle:block group-focus-visible/toggle:block",
              )}
            />
          </TooltipIconButton>
        </div>

        <nav
          className={cn(
            "relative flex flex-1 flex-col gap-0.5 px-2",
            collapsed ? "overflow-hidden" : "scroll-fade overflow-y-auto",
          )}
        >
          <TabPill name="sidebar" className="rounded-xl" />
          <NewButton className={cn(navRow, "group/new")}>
            <HugeiconsIcon icon={Add01Icon} className="size-4.5 shrink-0" />
            <span className={label}>{t("New")}</span>
            <kbd className="text-muted-foreground font-sans text-xs opacity-0 group-hover/new:opacity-100 group-focus-visible/new:opacity-100 pointer-coarse:hidden">
              {keys.mod} I
            </kbd>
          </NewButton>
          <NavLink href="/library" className={navRow}>
            <HugeiconsIcon icon={LibraryIcon} className="size-4.5 shrink-0" />
            <span className={label}>{t("Library")}</span>
          </NavLink>
          <NavLink href="/automations" className={navRow}>
            <AutomationsIcon unseen={unseenRuns} className="size-4.5" />
            <span className={label}>{t("Automations")}</span>
          </NavLink>
          <NavLink href="/plugins" className={navRow}>
            <HugeiconsIcon icon={AtIcon} className="size-4.5 shrink-0" />
            <span className={label}>{t("Plugins")}</span>
          </NavLink>
          <div
            inert={collapsed}
            className={cn(
              "flex flex-col gap-0.5 transition-[opacity,visibility] duration-300 ease-out-quint motion-reduce:transition-none",
              collapsed && "invisible opacity-0",
            )}
          >
            <BotList />
            <Recents onSeeAll={() => setSearching(true)} />
          </div>
        </nav>
        <div className="shrink-0 p-2">
          <AccountRow collapsed={collapsed} />
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <div className="absolute top-3 start-2 z-30 lg:hidden print:hidden">
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="bg-background/70 size-8">
              <span className="relative">
                <HugeiconsIcon icon={Menu01Icon} className="size-4" />
                {unseenRuns && <UnseenDot />}
              </span>
              <span className="sr-only">{t("Open menu")}</span>
            </Button>
          </SheetTrigger>
        </div>
        <SheetContent side={rtl ? "right" : "left"} className="bg-sidebar flex flex-col gap-0 p-0">
          <SheetTitle className="flex h-14 shrink-0 items-center px-4">
            <Mark size={20} color="currentColor" />
          </SheetTitle>
          <nav className="scroll-fade relative flex flex-col gap-0.5 overflow-y-auto px-2">
            <TabPill className="rounded-xl" />
            <NewButton className={mobileRow} onDone={() => setMobileOpen(false)}>
              <HugeiconsIcon icon={Add01Icon} className="size-4 shrink-0" />
              <span>{t("New")}</span>
            </NewButton>
            <NavLink href="/library" className={mobileRow} onDone={() => setMobileOpen(false)}>
              <HugeiconsIcon icon={LibraryIcon} className="size-4 shrink-0" />
              <span>{t("Library")}</span>
            </NavLink>
            <NavLink href="/automations" className={mobileRow} onDone={() => setMobileOpen(false)}>
              <AutomationsIcon unseen={unseenRuns} className="size-4" />
              <span>{t("Automations")}</span>
            </NavLink>
            <NavLink href="/plugins" className={mobileRow} onDone={() => setMobileOpen(false)}>
              <HugeiconsIcon icon={AtIcon} className="size-4 shrink-0" />
              <span>{t("Plugins")}</span>
            </NavLink>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setSearching(true);
              }}
              className={cn("hover:bg-muted flex items-center rounded-md text-start", mobileRow)}
            >
              <HugeiconsIcon icon={Search01Icon} className="size-4 shrink-0" />
              <span>{t("Search chats")}</span>
            </button>
            <BotList onDone={() => setMobileOpen(false)} />
            <Recents
              onDone={() => setMobileOpen(false)}
              onSeeAll={() => {
                setMobileOpen(false);
                setSearching(true);
              }}
            />
          </nav>
          <div className="mt-auto shrink-0 p-2">
            <AccountRow onDone={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1 overflow-hidden print:overflow-visible">{children}</div>
      {bot && <BotPanel bot={bot} />}
      <SettingsDialog />
      <SearchDialog open={searching} onOpenChange={setSearching} />
      <ShortcutsSheet />
      <SignInDialog />
      <AskSelection />
    </div>
  );
};

type RowProps = { className: string; children: ReactNode; onDone?: () => void };

const NewButton: FC<RowProps> = ({ className, children, onDone }) => {
  const startChat = useStartChat();
  return (
    <Button
      variant="ghost"
      asChild
      className={cn("hover:bg-muted dark:hover:bg-muted justify-start font-normal", className)}
    >
      <Link
        href="/"
        onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
          event.preventDefault();
          startChat();
          onDone?.();
        }}
      >
        {children}
      </Link>
    </Button>
  );
};

const NavLink: FC<RowProps & { href: string }> = ({ href, className, children, onDone }) => (
  <Button
    variant="ghost"
    asChild
    className={cn("hover:bg-muted dark:hover:bg-muted justify-start font-normal", className)}
  >
    <Link href={href} onClick={onDone}>
      {children}
    </Link>
  </Button>
);

const RECENT_LIMIT = 4;

const Recents: FC<{ onDone?: () => void; onSeeAll: () => void }> = ({ onDone, onSeeAll }) => {
  const sessions = useSessions((s) => s.sessions);
  const t = useT();
  const [open, setOpen] = useState(true);
  const bots = useProjects((s) => s.bots);
  const chats =
    sessions?.filter((session) =>
      bots ? !bots.some((bot) => bot.id === session.projectId) : !session.projectId,
    ) ?? [];
  const ordered = [
    ...chats.filter((session) => session.pinned),
    ...chats.filter((session) => !session.pinned),
  ];
  const shown = ordered.slice(0, RECENT_LIMIT);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="group/chats text-muted-foreground hover:text-foreground flex items-center justify-between px-2.5 pt-6 pb-1 text-sm transition-colors"
      >
        {t("Chats")}
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className={cn(
            "size-4 opacity-0 transition-transform duration-300 ease-out-quint group-hover/sidebar:opacity-100 group-focus-visible/chats:opacity-100 motion-reduce:transition-none pointer-coarse:opacity-100",
            !open && "-rotate-90 opacity-100",
          )}
        />
      </button>
      <Fold open={open} className="gap-0.5">
        {sessions !== undefined && chats.length === 0 && (
          <p className="text-muted-foreground/70 px-2.5 py-1.5 text-sm">{t("No chats yet")}</p>
        )}
        {shown.map((session) => (
          <SessionRow key={session.id} session={session} onOpen={onDone} />
        ))}
        {ordered.length > RECENT_LIMIT && (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-[12px] px-2.5 py-2 text-start text-sm font-[550] transition-colors"
          >
            {t("See all")}
          </button>
        )}
      </Fold>
    </>
  );
};
