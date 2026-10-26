"use client";

import { BotAvatar } from "@/components/botAvatar";
import { BotPicker, BotPickerPanel } from "@/components/botPicker";
import { BotPlugins } from "@/components/botPlugins";
import { BotProfile } from "@/components/botProfile";
import { BotProgress } from "@/components/botProgress";
import { RoutineDetail, RoutineList, useRoutines } from "@/components/botRoutines";
import { useT } from "@/components/i18n";
import { field } from "@/components/projectMenu";
import { type Project, projectNameError, useProjects } from "@/components/projects";
import { modalPrimaryButton } from "@/components/sessionMenu";
import { cn } from "@/lib/utils";
import { BOT_COLORS, type BOT_ICONS, PROJECT_NAME_MAX } from "@sirathic/server/projects";
import { IconX } from "@tabler/icons-react";
import { Dialog } from "radix-ui";
import { type FC, type FormEvent, useState } from "react";

const labelClass = "flex flex-col gap-1.5 text-sm font-medium";

export const BotSettings: FC<{
  bot?: Project;
  suggestedName?: string;
  onClose: () => void;
  onCreated?: (bot: Project) => void;
}> = ({ bot, suggestedName, onClose, onCreated }) => {
  const t = useT();
  const change = useProjects((s) => s.change);
  const createBot = useProjects((s) => s.createBot);
  const { routines, refresh } = useRoutines(bot?.id);
  const [name, setName] = useState(bot?.name ?? (suggestedName || t("New bot")));
  const [title, setTitle] = useState(bot?.title ?? "");
  const [instructions, setInstructions] = useState(bot?.instructions ?? "");
  const [color, setColor] = useState<(typeof BOT_COLORS)[number] | undefined>(() =>
    bot ? undefined : BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)],
  );
  const [symbol, setSymbol] = useState<(typeof BOT_ICONS)[number]>();
  const [routineId, setRoutineId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const routine = routines?.find((found) => found.id === routineId);
  const trimmed = name.trim();
  const nameError = projectNameError(t, trimmed);

  const diff = {
    ...(trimmed !== bot?.name && { name: trimmed }),
    ...(title.trim() !== bot?.title && { title: title.trim() }),
    ...(instructions.trim() !== bot?.instructions && { instructions: instructions.trim() }),
    ...(color && color !== bot?.color && { color }),
    ...(symbol && symbol !== bot?.symbol && { symbol }),
  };
  const canSave = Object.keys(diff).length > 0 && trimmed !== "" && !nameError && !creating;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    if (bot) {
      void change(bot.id, diff);
      onClose();
      return;
    }
    setCreating(true);
    const created = await createBot({
      ...diff,
      name: trimmed,
      language: document.documentElement.lang,
    });
    setCreating(false);
    if (created) onCreated?.(created);
  };

  return (
    <Dialog.Root open onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-60 bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="bg-background ring-foreground/7 fixed inset-x-4 top-1/2 z-60 mx-auto flex max-h-11/12 max-w-md -translate-y-1/2 flex-col rounded-3xl shadow-lg ring-1 outline-none ring-inset"
        >
          <div className="flex items-center justify-between px-5 pt-4">
            <Dialog.Title className={bot ? "text-base font-medium" : "sr-only"}>
              {bot ? t("Settings") : t("New bot")}
            </Dialog.Title>
            <Dialog.Close
              aria-label={t("Close")}
              className="text-muted-foreground hover:bg-muted hover:text-foreground ms-auto flex size-8 items-center justify-center rounded-full"
            >
              <IconX className="size-4.5" />
            </Dialog.Close>
          </div>
          {routine ? (
            <div className="overflow-y-auto px-5 pt-2 pb-5">
              <RoutineDetail
                routine={routine}
                onBack={() => setRoutineId(undefined)}
                onChanged={refresh}
              />
            </div>
          ) : (
            <form onSubmit={(event) => void save(event)} className="flex min-h-0 flex-col">
              <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4">
                <div className="flex flex-col items-center gap-3">
                  <BotAvatar
                    color={color ?? bot?.color ?? null}
                    icon={symbol ?? bot?.symbol ?? null}
                    className={bot ? "size-20" : "size-24"}
                  />
                  {bot && (
                    <BotPicker
                      color={color ?? bot.color}
                      icon={symbol ?? bot.symbol}
                      onColor={setColor}
                      onIcon={setSymbol}
                    />
                  )}
                </div>
                <label className={labelClass}>
                  <span className={cn(!bot && "sr-only")}>{t("Name")}</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={PROJECT_NAME_MAX}
                    aria-invalid={nameError !== undefined}
                    className={cn(
                      field,
                      "font-normal",
                      bot ? "h-9" : "h-11 rounded-xl text-center text-base",
                    )}
                  />
                  {nameError && <span className="text-destructive font-normal">{nameError}</span>}
                </label>
                {!bot && (
                  <BotPickerPanel
                    color={color ?? null}
                    icon={symbol ?? null}
                    onColor={setColor}
                    onIcon={setSymbol}
                    className="bg-foreground/3 rounded-2xl p-4"
                  />
                )}
                {bot && (
                  <>
                    <label className={labelClass}>
                      <span>
                        {t("Title")}{" "}
                        <span className="text-muted-foreground font-normal">{t("Optional")}</span>
                      </span>
                      <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        maxLength={PROJECT_NAME_MAX}
                        placeholder={t("A short role, like Quranic Arabic tutor")}
                        className={`${field} h-9 font-normal`}
                      />
                    </label>
                    <label className={labelClass}>
                      {t("Description")}
                      <textarea
                        value={instructions}
                        onChange={(event) => setInstructions(event.target.value)}
                        maxLength={4000}
                        rows={4}
                        placeholder={t("What should this bot do?")}
                        className={`${field} resize-none py-2 font-normal`}
                      />
                    </label>
                  </>
                )}
                {bot && <BotProgress id={bot.id} />}
                {routines && <RoutineList routines={routines} onOpen={setRoutineId} />}
                {bot && <BotPlugins id={bot.id} allowed={bot.plugins} />}
                {bot && <BotProfile bot={bot} />}
              </div>
              <div className={cn("px-5 py-3", bot ? "border-foreground/10 border-t" : "pb-5")}>
                <button
                  type="submit"
                  disabled={!canSave}
                  className={cn(modalPrimaryButton, "w-full", bot ? "h-9" : "h-10 rounded-full")}
                >
                  {bot ? t("Save") : creating ? t("Creating…") : t("Create")}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
