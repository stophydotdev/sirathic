"use client";

import { useAccount } from "@/components/account";
import { useChatOptions } from "@/components/chat-options";
import { CookieCard } from "@/components/cookie-card";
import {
  type Translate,
  useLocale,
  useLocalePath,
  useT,
} from "@/components/i18n";
import { isRtl } from "@/components/locales";
import { Logo } from "@/components/logo";
import { SearchDialog, SessionRow } from "@/components/session-menu";
import { type Session, useSessions } from "@/components/sessions";
import { SettingsDialog, useSettings } from "@/components/settings";
import { AccountRow, SignInDialog } from "@/components/sign-in";
import { TooltipIconButton } from "@/components/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  BookOpenIcon,
  LibraryIcon,
  ScrollTextIcon,
  MenuIcon,
  PanelLeftIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { type FC, type ReactNode, useEffect, useState } from "react";

export const ThreadShell: FC<{ children: ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const t = useT();
  const rtl = isRtl(useLocale());
  const href = useLocalePath();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const refresh = useAccount((s) => s.refresh);
  const refreshSessions = useSessions((s) => s.refresh);

  useEffect(() => {
    void useAccount.persist.rehydrate();
    void useSessions.persist.rehydrate();
  }, []);

  useEffect(() => {
    const onFocus = () => {
      void refresh();
      void refreshSessions();
    };
    onFocus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh, refreshSessions]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.ctrlKey) return;
      if (event.key.toLowerCase() === "i" && !event.shiftKey) {
        event.preventDefault();
        window.location.assign(href("/"));
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

  const navRow = cn(
    "h-10 gap-3 rounded-lg px-3 text-base has-[>svg]:px-3",
    collapsed && "w-10 justify-center px-0 has-[>svg]:px-0",
  );
  const mobileRow = "h-8 gap-2 rounded-md px-2.5 text-sm";

  return (
    <div className="relative flex h-full w-full overflow-hidden print:h-auto print:overflow-visible">
      <aside
        className={cn(
          "bg-sidebar border-sidebar-border hidden h-full shrink-0 flex-col overflow-hidden border-e transition-[width] duration-200 lg:flex print:hidden",
          collapsed ? "w-14" : "w-60",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-2">
          {!collapsed && (
            <span className="text-foreground flex h-10 flex-1 items-center px-2">
              <Logo height={22} />
            </span>
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
              <SearchIcon className="size-4" />
            </TooltipIconButton>
          )}
          <TooltipIconButton
            variant="ghost"
            size="icon"
            tooltip={collapsed ? t("Expand sidebar") : t("Collapse sidebar")}
            side={rtl ? "left" : "right"}
            onClick={() => setCollapsed(!collapsed)}
            className="text-muted-foreground hover:text-foreground mx-1 size-8 rounded-full"
          >
            <PanelLeftIcon className="size-4" />
          </TooltipIconButton>
        </div>

        <nav
          className={cn(
            "flex flex-1 flex-col gap-0.5 px-2",
            collapsed ? "overflow-hidden" : "overflow-y-auto",
          )}
        >
          <NewButton className={navRow}>
            <PlusIcon className="size-4.5 shrink-0" />
            {!collapsed && <span className="flex-1">{t("New")}</span>}
            {!collapsed && (
              <kbd className="text-muted-foreground font-sans text-xs pointer-coarse:hidden">
                ⌃I
              </kbd>
            )}
          </NewButton>
          {NAV_LINKS.map(({ path, label, Icon }) => (
            <LinkButton key={path} href={href(path)} className={navRow}>
              <Icon className="size-4.5 shrink-0" />
              {!collapsed && <span>{t(label)}</span>}
            </LinkButton>
          ))}
          {!collapsed && <Recents />}
        </nav>
        <div className="shrink-0 p-2">
          <AccountRow collapsed={collapsed} />
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <div className="absolute top-3 start-2 z-30 lg:hidden print:hidden">
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="bg-background/70 size-8"
            >
              <MenuIcon className="size-4" />
              <span className="sr-only">{t("Open menu")}</span>
            </Button>
          </SheetTrigger>
        </div>
        <SheetContent
          side={rtl ? "right" : "left"}
          className="bg-sidebar flex flex-col gap-0 p-0"
        >
          <SheetTitle className="flex h-14 shrink-0 items-center px-4">
            <Logo height={22} />
          </SheetTitle>
          <nav className="flex flex-col gap-0.5 overflow-y-auto px-2">
            <NewButton
              className={mobileRow}
              onDone={() => setMobileOpen(false)}
            >
              <PlusIcon className="size-4 shrink-0" />
              <span>{t("New")}</span>
            </NewButton>
            {NAV_LINKS.map(({ path, label, Icon }) => (
              <LinkButton
                key={path}
                href={href(path)}
                className={mobileRow}
                onDone={() => setMobileOpen(false)}
              >
                <Icon className="size-4 shrink-0" />
                <span>{t(label)}</span>
              </LinkButton>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setSearching(true);
              }}
              className={cn(
                "hover:bg-muted flex items-center rounded-md text-start",
                mobileRow,
              )}
            >
              <SearchIcon className="size-4 shrink-0" />
              <span>{t("Search chats")}</span>
            </button>
            <Recents onDone={() => setMobileOpen(false)} />
          </nav>
          <div className="mt-auto shrink-0 p-2">
            <AccountRow onDone={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1 overflow-hidden print:overflow-visible">
        {children}
      </div>
      <SettingsDialog />
      <SearchDialog open={searching} onOpenChange={setSearching} />
      <SignInDialog />
      <CookieCard />
    </div>
  );
};

type RowProps = { className: string; children: ReactNode; onDone?: () => void };

const NewButton: FC<RowProps> = ({ className, children, onDone }) => {
  const href = useLocalePath();
  return (
    <Button
      variant="ghost"
      asChild
      className={cn("hover:bg-muted justify-start font-normal", className)}
    >
      <a href={href("/")} onClick={onDone}>
        {children}
      </a>
    </Button>
  );
};

const DAY_MS = 86_400_000;

const dayLabel = (updatedAt: string, today: number, t: Translate) => {
  const time = new Date(updatedAt).getTime();
  if (time >= today) return t("Today");
  if (time >= today - DAY_MS) return t("Yesterday");
  if (time >= today - 7 * DAY_MS) return t("Previous 7 days");
  if (time >= today - 30 * DAY_MS) return t("Previous 30 days");
  return t("Older");
};

function byDay(sessions: Session[], t: Translate) {
  const today = new Date().setHours(0, 0, 0, 0);
  const days: { label: string; sessions: Session[] }[] = [];
  for (const session of sessions) {
    const label = dayLabel(session.updatedAt, today, t);
    const last = days.at(-1);
    if (last?.label === label) last.sessions.push(session);
    else days.push({ label, sessions: [session] });
  }
  return days;
}

const NAV_LINKS = [
  { path: "/library", label: "Library", Icon: LibraryIcon },
  { path: "/quran", label: "Quran", Icon: BookOpenIcon },
  { path: "/hadith", label: "Hadith", Icon: ScrollTextIcon },
] as const;

const ROW_WIDTHS = ["w-4/5", "w-3/5", "w-5/6", "w-1/2", "w-3/4", "w-2/3"];

const LinkButton: FC<RowProps & { href: string }> = ({
  href,
  className,
  children,
  onDone,
}) => {
  return (
    <Button
      variant="ghost"
      asChild
      className={cn("hover:bg-muted justify-start font-normal", className)}
    >
      <Link href={href} onClick={onDone}>
        {children}
      </Link>
    </Button>
  );
};

const Recents: FC<{ onDone?: () => void }> = ({ onDone }) => {
  const sessions = useSessions((s) => s.sessions);
  const t = useT();
  const href = useLocalePath();
  const [open, setOpen] = useState(true);
  const pinned = sessions?.filter((session) => session.pinned) ?? [];
  const recent = sessions?.filter((session) => !session.pinned) ?? [];

  return (
    <>
      {pinned.length > 0 && (
        <>
          <p className="text-muted-foreground px-2.5 pt-6 pb-1 text-sm">
            {t("Pinned")}
          </p>
          {pinned.map((session) => (
            <SessionRow key={session.id} session={session} onOpen={onDone} />
          ))}
        </>
      )}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="text-muted-foreground hover:text-foreground flex items-center justify-between px-2.5 pt-6 pb-1 text-sm"
      >
        {t("Recents")}
        <ChevronDown className={cn("size-4", !open && "-rotate-90")} />
      </button>
      {open &&
        sessions === undefined &&
        ROW_WIDTHS.map((width) => (
          <div key={width} className="flex h-8 items-center px-2.5">
            <Skeleton className={cn("h-2.5", width)} />
          </div>
        ))}
      {open && sessions !== undefined && recent.length === 0 && (
        <p className="text-muted-foreground/70 px-2.5 py-1.5 text-sm">
          {t("No chats yet")}
        </p>
      )}
      {open &&
        byDay(recent, t).map((day) => (
          <div key={day.label} className="flex flex-col gap-0.5">
            <p className="text-muted-foreground/70 px-2.5 pt-2 pb-0.5 text-xs">
              {day.label}
            </p>
            {day.sessions.map((session) => (
              <SessionRow key={session.id} session={session} onOpen={onDone} />
            ))}
          </div>
        ))}
      {open && sessions !== undefined && sessions.length > 0 && (
        <Link
          href={href("/library")}
          onClick={onDone}
          className="text-muted-foreground hover:text-foreground px-2.5 py-1.5 text-sm"
        >
          {t("View all")}
        </Link>
      )}
    </>
  );
};
