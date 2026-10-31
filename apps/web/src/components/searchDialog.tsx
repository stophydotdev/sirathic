"use client";

import { BotAvatar } from "@/components/botAvatar";
import { useBotPanel } from "@/components/botSettings";
import { saveDraft } from "@/components/draft";
import { useT } from "@/components/i18n";
import { THEME_NAMES, usePreferences } from "@/components/preferences";
import { useGroups } from "@/components/groups";
import { useProjects } from "@/components/projects";
import { findSessions, type Session } from "@/components/sessions";
import { panel } from "@/components/sessionMenu";
import { SECTION_DETAILS, SECTIONS, useSettings } from "@/components/settings";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { botLabel } from "@sirathic/app/botGroups";
import { THEMES } from "@sirathic/app/preferences";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Add01Icon,
  AtIcon,
  Clock04Icon,
  IncognitoIcon,
  LibraryIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { type FC, Fragment, type ReactNode, useEffect, useState } from "react";

type Routine = Awaited<ReturnType<typeof api.automations.list.query>>[number];

type Command = {
  key: string;
  icon?: ReactNode;
  label: string;
  hint?: string;
  snippet?: string | null;
  run: () => void;
};

const icon = (shown: IconSvgElement) => <HugeiconsIcon icon={shown} className="size-4" />;

const GROUP_LIMIT = 8;

const heading = "text-muted-foreground px-2 pt-2 pb-1 text-xs";

const Highlight: FC<{ text: string; query: string }> = ({ text, query }) => {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <strong className="font-semibold">{text.slice(at, at + query.length)}</strong>
      {text.slice(at + query.length)}
    </>
  );
};

export const SearchDialog: FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Session[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [active, setActive] = useState(0);
  const bots = useProjects((s) => s.bots);
  const rooms = useGroups((s) => s.groups);
  const t = useT();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    let current = true;
    const timer = setTimeout(
      () =>
        void findSessions(query.trim()).then((sessions) => {
          if (current) setFound(sessions);
        }),
      150,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    let current = true;
    void api.automations.list
      .query()
      .catch(() => [])
      .then((list) => {
        if (current) setRoutines(list);
      });
    return () => {
      current = false;
    };
  }, [open]);

  useEffect(() => {
    document
      .querySelector('[data-search-option][aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const asked = query.trim();
  const matches = (text: string) => text.toLowerCase().includes(asked.toLowerCase());
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const commands: Command[] = [
    ...(asked
      ? [
          {
            key: "ask",
            icon: <HugeiconsIcon icon={Search01Icon} className="size-4" />,
            label: t("Ask Sirathic"),
            hint: asked,
            run: () => {
              saveDraft(asked);
              window.location.assign("/");
            },
          },
        ]
      : []),
    {
      key: "new",
      icon: <HugeiconsIcon icon={Add01Icon} className="size-4" />,
      label: t("New chat"),
      run: () => window.location.assign("/"),
    },
    {
      key: "incognito",
      icon: <HugeiconsIcon icon={IncognitoIcon} className="size-4" />,
      label: t("New incognito chat"),
      run: () => window.location.assign("/?incognito"),
    },
  ];

  const [pages, settings, themes] = [
    [
      [t("Library"), LibraryIcon, "/library"],
      [t("Automations"), Clock04Icon, "/automations"],
      [t("Plugins"), AtIcon, "/plugins"],
    ] as const,
    SECTIONS,
    THEMES,
  ];
  const finders: Command[] = asked
    ? [
        ...pages.map(([label, shown, href]) => ({
          key: href,
          icon: icon(shown),
          label,
          run: () => go(href),
        })),
        ...settings.map((section) => ({
          key: section,
          icon: icon(SECTION_DETAILS[section].icon),
          label: `${t("Settings")} · ${t(SECTION_DETAILS[section].name)}`,
          run: () => {
            onOpenChange(false);
            useSettings.getState().show(section);
          },
        })),
        ...themes.map((theme) => ({
          key: theme,
          icon: icon(SECTION_DETAILS.appearance.icon),
          label: `${t("Theme")} · ${t(THEME_NAMES[theme])}`,
          run: () => {
            onOpenChange(false);
            usePreferences.getState().change({ theme });
          },
        })),
      ].filter((action) => matches(action.label))
    : [];

  const botMatches: Command[] = asked
    ? (bots ?? [])
        .filter((bot) => matches(botLabel(bot)))
        .map((bot) => ({
          key: bot.id,
          icon: (
            <BotAvatar
              color={bot.color}
              body={bot.symbol}
              seed={bot.id}
              state="ready"
              className="size-5"
            />
          ),
          label: botLabel(bot),
          run: () => go(`/bot/${bot.id}`),
        }))
    : [];

  const routineMatches: Command[] = asked
    ? routines
        .filter((routine) => matches(routine.name))
        .map((routine) => ({
          key: routine.id,
          icon: icon(Clock04Icon),
          label: routine.name,
          run: () => {
            if (routine.projectId) useBotPanel.getState().show("screen");
            go(routine.projectId ? `/bot/${routine.projectId}` : "/automations");
          },
        }))
    : [];

  const results: Command[] = found.map((session) => ({
    key: session.id,
    label: session.title,
    snippet: matches(session.title) ? undefined : session.snippet,
    run: () =>
      go(
        bots?.some((bot) => bot.id === session.id)
          ? `/bot/${session.id}`
          : rooms?.some((room) => room.id === session.id)
            ? `/group/${session.id}`
            : `/c/${session.id}`,
      ),
  }));

  const groups = [
    { name: t("Commands"), items: commands, marked: false },
    { name: t("Bots"), items: botMatches.slice(0, GROUP_LIMIT), marked: true },
    { name: t("Routines"), items: routineMatches.slice(0, GROUP_LIMIT), marked: true },
    { name: t("Actions"), items: finders.slice(0, GROUP_LIMIT), marked: true },
    { name: t("Results"), items: results, marked: true },
  ];
  const options = groups.flatMap((group) => group.items);
  const selected = Math.min(active, options.length - 1);

  const option = (command: Command, index: number, marked: boolean) => (
    <button
      key={command.key}
      type="button"
      role="option"
      data-search-option
      aria-selected={index === selected}
      onMouseMove={() => setActive(index)}
      onClick={command.run}
      className={cn(
        "flex min-h-9 w-full items-center gap-3 rounded-lg px-2 text-start text-base",
        !command.icon && "min-h-10",
        index === selected && "bg-foreground/5",
      )}
    >
      {command.icon}
      <span className="flex min-w-0 flex-col">
        <span className="truncate">
          <Highlight text={command.label} query={marked ? asked : ""} />
        </span>
        {command.snippet && (
          <span className="text-muted-foreground truncate text-sm">
            <Highlight text={command.snippet} query={asked} />
          </span>
        )}
      </span>
      {command.hint && <span className="text-muted-foreground truncate">{command.hint}</span>}
    </button>
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60]" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className={cn(panel, "top-[20%] max-w-[620px] translate-y-0 rounded-[16px]")}
        >
          <Dialog.Title className="sr-only">{t("Search chats")}</Dialog.Title>
          <div className="border-border/50 flex h-14 items-center gap-3 border-b px-5">
            <HugeiconsIcon icon={Search01Icon} className="text-muted-foreground size-4" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              placeholder={t("Type a command or search")}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const step = event.key === "ArrowDown" ? 1 : -1;
                  setActive((selected + step + options.length) % options.length);
                } else if (event.key === "Enter") {
                  options[selected]?.run();
                }
              }}
              className="placeholder:text-muted-foreground flex-1 bg-transparent text-base outline-none"
            />
          </div>
          <div role="listbox" className="flex max-h-[min(60vh,420px)] flex-col overflow-y-auto p-3">
            {groups.map((group, position) => {
              const before = groups
                .slice(0, position)
                .reduce((count, earlier) => count + earlier.items.length, 0);
              const last = position === groups.length - 1;
              if (group.items.length === 0 && !last) return null;
              return (
                <Fragment key={group.name}>
                  <p className={cn(heading, position > 0 && "pt-3")}>{group.name}</p>
                  {group.items.length === 0 ? (
                    <p className="text-muted-foreground px-2 py-2 text-sm">{t("No chats found")}</p>
                  ) : (
                    group.items.map((item, index) => option(item, before + index, group.marked))
                  )}
                </Fragment>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
