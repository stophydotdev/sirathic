"use client";

import { BotAvatar } from "@/components/botAvatar";
import { botLabel } from "@/components/botGroups";
import { useT } from "@/components/i18n";
import { type Project, useProjects } from "@/components/projects";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Tick02Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { usePathname, useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { type FC, useEffect, useState } from "react";

type Option = { kind: "create"; name: string } | { kind: "bot"; bot: Project };

export const BotSwitcher: FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}> = ({ open, onOpenChange, onDone }) => {
  const bots = useProjects((s) => s.bots) ?? [];
  const createBot = useProjects((s) => s.createBot);
  const router = useRouter();
  const current = usePathname();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState<number>();
  const [creating, setCreating] = useState(false);
  const t = useT();
  const typed = query.trim();
  const shown = bots.filter((bot) => botLabel(bot).toLowerCase().includes(typed.toLowerCase()));
  const options: Option[] = [
    { kind: "create", name: typed || t("New bot") },
    ...shown.map((bot) => ({ kind: "bot" as const, bot })),
  ];
  const active = Math.min(cursor ?? (typed && shown.length > 0 ? 1 : 0), options.length - 1);

  useEffect(() => {
    document
      .querySelector('[data-bot-option][aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setQuery("");
      setCursor(undefined);
    }
  };

  const choose = async (option: Option) => {
    if (creating) return;
    if (option.kind === "bot") {
      close(false);
      onDone?.();
      router.push(`/bot/${option.bot.id}`);
      return;
    }
    setCreating(true);
    const created = await createBot({ name: option.name, language: document.documentElement.lang });
    setCreating(false);
    if (!created) return;
    close(false);
    onDone?.();
    router.push(`/bot/${created.id}`);
  };

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-60 bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="bg-card ring-foreground/7 fixed start-1/2 top-16 z-60 flex w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 flex-col rounded-2xl shadow-lg ring-1 outline-none ring-inset rtl:translate-x-1/2"
        >
          <Dialog.Title className="sr-only">{t("Search or create bots")}</Dialog.Title>
          <div className="flex h-12 items-center gap-3 px-4">
            <HugeiconsIcon icon={Search01Icon} className="text-muted-foreground size-4" />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCursor(undefined);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const step = event.key === "ArrowDown" ? 1 : -1;
                  setCursor((active + step + options.length) % options.length);
                } else if (event.key === "Enter" && options[active]) {
                  event.preventDefault();
                  void choose(options[active]);
                }
              }}
              placeholder={t("Search or create bots")}
              className="placeholder:text-muted-foreground flex-1 bg-transparent text-base outline-none"
            />
          </div>
          <div role="listbox" className="flex max-h-80 flex-col overflow-y-auto p-2 pt-0">
            {options.map((option, index) => (
              <button
                key={option.kind === "create" ? "create" : option.bot.id}
                type="button"
                role="option"
                data-bot-option
                aria-selected={index === active}
                onMouseMove={() => setCursor(index)}
                onClick={() => void choose(option)}
                className={cn(
                  "flex h-10 w-full items-center gap-3 rounded-xl px-2 text-start text-sm",
                  index === active && "bg-foreground/8",
                )}
              >
                {option.kind === "create" ? (
                  <>
                    <span className="bg-foreground/10 flex size-7 shrink-0 items-center justify-center rounded-full">
                      <HugeiconsIcon icon={Add01Icon} className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {typed ? t("Create “{name}”", { name: typed }) : t("Create new bot")}
                    </span>
                  </>
                ) : (
                  <>
                    <BotAvatar color={option.bot.color} seed={option.bot.id} className="size-7" />
                    <span className="min-w-0 flex-1 truncate">{botLabel(option.bot)}</span>
                    {current === `/bot/${option.bot.id}` && (
                      <HugeiconsIcon icon={Tick02Icon} className="size-4" />
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
