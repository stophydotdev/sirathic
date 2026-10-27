"use client";

import { BotAvatar } from "@/components/botAvatar";
import { useT } from "@/components/i18n";
import { useProjects } from "@/components/projects";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { type FC, type ReactNode, useState } from "react";

const row =
  "hover:bg-foreground/8 focus-visible:bg-foreground/8 flex h-8 shrink-0 items-center gap-2 rounded-lg px-2 text-start text-sm outline-none";

export const BotSwitcher: FC<{
  current: string;
  onCreate: (name: string) => void;
  children: ReactNode;
}> = ({ current, onCreate, children }) => {
  const bots = useProjects((s) => s.bots) ?? [];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const t = useT();
  const typed = query.trim();
  const shown = bots.filter((bot) => bot.name.toLowerCase().includes(typed.toLowerCase()));
  const taken = bots.some((bot) => bot.name.toLowerCase() === typed.toLowerCase());

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const pick = (id: string) => {
    close();
    if (id !== current) router.push(`/bot/${id}`);
  };
  const create = () => {
    close();
    onCreate(typed);
  };

  return (
    <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <PopoverAnchor asChild>
        <div className="flex min-w-0 items-center gap-0.5">
          {children}
          <PopoverTrigger
            aria-label={t("Search or create bots")}
            title={t("Search or create bots")}
            className="text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted flex size-6 shrink-0 items-center justify-center rounded-lg"
          >
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="border-foreground/6 w-80 gap-0 rounded-2xl border p-1 ring-0 sm:w-105"
      >
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (typed && !taken) create();
            else if (shown[0]) pick(shown[0].id);
          }}
          placeholder={t("Search or create bots")}
          className="placeholder:text-muted-foreground w-full bg-transparent px-2 py-2.5 text-sm outline-none"
        />
        <div className="flex max-h-64 flex-col overflow-y-auto">
          {shown.map((bot) => (
            <button key={bot.id} type="button" onClick={() => pick(bot.id)} className={row}>
              <BotAvatar color={bot.color} icon={bot.symbol} />
              <span className="min-w-0 flex-1 truncate">{bot.name}</span>
              {bot.id === current && <HugeiconsIcon icon={Tick02Icon} className="size-4" />}
            </button>
          ))}
          {typed && !taken && (
            <button type="button" onClick={create} className={row}>
              <span className="bg-foreground/8 flex size-6 items-center justify-center rounded-full">
                <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate">
                {t("Create “{name}”", { name: typed })}
              </span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
