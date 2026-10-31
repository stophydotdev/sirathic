"use client";

import { BotAvatar } from "@/components/botAvatar";
import { useGroups } from "@/components/groups";
import { useT } from "@/components/i18n";
import { useProjects } from "@/components/projects";
import { cn } from "@/lib/utils";
import { botLabel } from "@sirathic/app/botGroups";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { type FC, useState } from "react";

export const GroupDialog: FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}> = ({ open, onOpenChange, onDone }) => {
  const bots = useProjects((s) => s.bots) ?? [];
  const createGroup = useGroups((s) => s.createGroup);
  const router = useRouter();
  const t = useT();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const ready = name.trim() !== "" && picked.length >= 2 && !creating;

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setName("");
      setPicked([]);
    }
  };

  const create = async () => {
    setCreating(true);
    const created = await createGroup({ name: name.trim(), members: picked });
    setCreating(false);
    if (!created) return;
    close(false);
    onDone?.();
    router.push(`/group/${created.id}`);
  };

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Overlay className="dim fixed inset-0 z-60 bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="pop bg-card ring-foreground/7 fixed start-1/2 top-16 z-60 flex w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 flex-col rounded-2xl shadow-lg ring-1 outline-none ring-inset rtl:translate-x-1/2"
        >
          <Dialog.Title className="sr-only">{t("New group")}</Dialog.Title>
          <div className="flex h-12 items-center px-4">
            <input
              autoFocus
              value={name}
              maxLength={50}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("Group name")}
              className="placeholder:text-muted-foreground flex-1 bg-transparent text-base outline-none"
            />
          </div>
          <div
            role="listbox"
            aria-multiselectable
            className="flex max-h-80 flex-col overflow-y-auto p-2 pt-0"
          >
            {bots.map((bot) => {
              const on = picked.includes(bot.id);
              return (
                <button
                  key={bot.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() =>
                    setPicked(on ? picked.filter((id) => id !== bot.id) : [...picked, bot.id])
                  }
                  className={cn(
                    "hover:bg-foreground/8 flex h-10 w-full items-center gap-3 rounded-xl px-2 text-start text-sm",
                    on && "bg-foreground/8",
                  )}
                >
                  <BotAvatar color={bot.color} body={bot.symbol} seed={bot.id} className="size-7" />
                  <span className="min-w-0 flex-1 truncate">{botLabel(bot)}</span>
                  {on && <HugeiconsIcon icon={Tick02Icon} className="size-4" />}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-3 p-3 pt-1">
            <p className="text-muted-foreground ps-2 text-xs">
              {picked.length < 2 ? t("Pick at least two bots") : ""}
            </p>
            <button
              type="button"
              disabled={!ready}
              onClick={() => void create()}
              className="bg-foreground text-background h-8 rounded-lg px-3 text-sm font-medium disabled:opacity-40"
            >
              {t("Create group")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
