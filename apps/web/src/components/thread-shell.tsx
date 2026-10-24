"use client";

import { useAccount } from "@/components/account";
import { useChatOptions } from "@/components/chat-options";
import { useLocale, useLocalePath, useT } from "@/components/i18n";
import { isRtl } from "@/components/locales";
import { Logo, Mark } from "@/components/logo";
import { SearchDialog, SessionRow } from "@/components/session-menu";
import { useSessions } from "@/components/sessions";
import { SettingsDialog, useSettings } from "@/components/settings";
import { AccountRow, SignInDialog } from "@/components/sign-in";
import { TooltipIconButton } from "@/components/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AskSelection } from "@/components/ask-selection";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  IconChevronDown,
  IconLayoutSidebar,
  IconMenu2,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react";
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
    "h-10 gap-2.75 rounded-lg px-2.5 text-base has-[>svg]:px-2.5",
    collapsed && "w-10 justify-center px-0 has-[>svg]:px-0",
  );
  const mobileRow = "h-8 gap-2 rounded-md px-2.5 text-sm";

  return (
    <div className="relative flex h-full w-full overflow-hidden print:h-auto print:overflow-visible">
      <aside
        className={cn(
          "bg-background border-sidebar-border hidden h-full shrink-0 flex-col overflow-hidden border-e transition-[width] duration-200 lg:flex print:hidden",
          collapsed ? "w-14" : "w-60",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-2">
          {!collapsed && (
            <a
              href={href("/")}
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
              <IconSearch className="size-4" />
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
            <IconLayoutSidebar
              className={cn(
                "size-4",
                collapsed && "hidden group-hover/toggle:block group-focus-visible/toggle:block",
              )}
            />
          </TooltipIconButton>
        </div>

        <nav
          className={cn(
            "flex flex-1 flex-col gap-0.5 px-2",
            collapsed ? "overflow-hidden" : "overflow-y-auto",
          )}
        >
          <NewButton className={cn(navRow, "group/new")}>
            <IconPlus className="size-4.5 shrink-0" />
            {!collapsed && <span className="flex-1">{t("New")}</span>}
            {!collapsed && (
              <kbd className="text-muted-foreground font-sans text-xs opacity-0 group-hover/new:opacity-100 group-focus-visible/new:opacity-100 pointer-coarse:hidden">
                ⌃I
              </kbd>
            )}
          </NewButton>
          {!collapsed && <Recents />}
        </nav>
        {!collapsed && <SignedOutLegalLinks />}
        <div className="border-sidebar-border shrink-0 border-t p-2">
          <AccountRow collapsed={collapsed} />
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <div className="absolute top-3 start-2 z-30 lg:hidden print:hidden">
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="bg-background/70 size-8">
              <IconMenu2 className="size-4" />
              <span className="sr-only">{t("Open menu")}</span>
            </Button>
          </SheetTrigger>
        </div>
        <SheetContent side={rtl ? "right" : "left"} className="bg-sidebar flex flex-col gap-0 p-0">
          <SheetTitle className="flex h-14 shrink-0 items-center px-4">
            <Logo height={22} />
          </SheetTitle>
          <nav className="flex flex-col gap-0.5 overflow-y-auto px-2">
            <NewButton className={mobileRow} onDone={() => setMobileOpen(false)}>
              <IconPlus className="size-4 shrink-0" />
              <span>{t("New")}</span>
            </NewButton>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setSearching(true);
              }}
              className={cn("hover:bg-muted flex items-center rounded-md text-start", mobileRow)}
            >
              <IconSearch className="size-4 shrink-0" />
              <span>{t("Search chats")}</span>
            </button>
            <Recents onDone={() => setMobileOpen(false)} />
          </nav>
          <div className="mt-auto shrink-0">
            <SignedOutLegalLinks />
            <div className="border-sidebar-border border-t p-2">
              <AccountRow onDone={() => setMobileOpen(false)} />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1 overflow-hidden print:overflow-visible">{children}</div>
      <SettingsDialog />
      <SearchDialog open={searching} onOpenChange={setSearching} />
      <SignInDialog />
      <AskSelection />
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

const SignedOutLegalLinks: FC = () => {
  const t = useT();
  const href = useLocalePath();
  const signedIn = useAccount((s) => s.status?.signedIn);
  if (signedIn) return null;
  return (
    <p className="text-muted-foreground flex shrink-0 gap-1.5 px-4.5 pb-2 text-xs">
      <Link href={href("/privacy")} className="hover:text-foreground">
        {t("Privacy")}
      </Link>
      <span aria-hidden>·</span>
      <Link href={href("/terms")} className="hover:text-foreground">
        {t("Terms")}
      </Link>
    </p>
  );
};

const ROW_WIDTHS = ["w-4/5", "w-3/5", "w-5/6", "w-1/2", "w-3/4", "w-2/3"];
const RECENT_LIMIT = 8;

const Recents: FC<{ onDone?: () => void }> = ({ onDone }) => {
  const sessions = useSessions((s) => s.sessions);
  const t = useT();
  const [open, setOpen] = useState(true);
  const pinned = sessions?.filter((session) => session.pinned) ?? [];
  const recent = sessions?.filter((session) => !session.pinned) ?? [];

  return (
    <>
      {pinned.length > 0 && (
        <>
          <p className="text-muted-foreground px-2.5 pt-6 pb-1 text-sm">{t("Pinned")}</p>
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
        <IconChevronDown className={cn("size-4", !open && "-rotate-90")} />
      </button>
      {open &&
        sessions === undefined &&
        ROW_WIDTHS.map((width) => (
          <div key={width} className="flex h-8 items-center px-2.5">
            <Skeleton className={cn("h-2.5", width)} />
          </div>
        ))}
      {open && sessions !== undefined && recent.length === 0 && (
        <p className="text-muted-foreground/70 px-2.5 py-1.5 text-sm">{t("No chats yet")}</p>
      )}
      {open &&
        recent
          .slice(0, RECENT_LIMIT)
          .map((session) => <SessionRow key={session.id} session={session} onOpen={onDone} />)}
    </>
  );
};
