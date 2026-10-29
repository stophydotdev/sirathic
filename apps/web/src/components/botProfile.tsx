"use client";

import { AutomationEditor } from "@/components/automationEditor";
import { BotAvatar } from "@/components/botAvatar";
import { BotPickerPanel } from "@/components/botPicker";
import { RoutineDetail, RoutineList, useRoutines } from "@/components/botRoutines";
import { useT } from "@/components/i18n";
import { type Project, projectNameError, useProjects } from "@/components/projects";
import { modalPrimaryButton } from "@/components/sessionMenu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { blankDraft } from "@sirathic/app/automationDraft";
import { type BOT_BODIES, type BOT_COLORS, PROJECT_NAME_MAX } from "@sirathic/server/projects";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Dialog } from "radix-ui";
import { type FC, type ReactNode, useState } from "react";
import { create } from "zustand";

const INSTRUCTIONS_MAX = 4000;

const fieldClass =
  "bg-card border-border focus-visible:border-foreground/30 w-full rounded-xl border px-3 text-sm outline-none";

export const useBotProfile = create<{ open: boolean; setOpen: (open: boolean) => void }>()(
  (set) => ({
    open: false,
    setOpen: (open) => set({ open }),
  }),
);

const Field: FC<{ label: ReactNode; error?: string; children: ReactNode }> = ({
  label,
  error,
  children,
}) => (
  <label className="flex flex-col gap-1.5 text-sm">
    <span className="text-muted-foreground ps-1">{label}</span>
    {children}
    {error && <span className="text-destructive ps-1">{error}</span>}
  </label>
);

const ProfileForm: FC<{ bot: Project; onDone: () => void }> = ({ bot, onDone }) => {
  const change = useProjects((s) => s.change);
  const { routines, refresh } = useRoutines(bot.id);
  const [name, setName] = useState(bot.name);
  const [title, setTitle] = useState(bot.title);
  const [instructions, setInstructions] = useState(bot.instructions);
  const [look, setLook] = useState<{
    color?: (typeof BOT_COLORS)[number];
    symbol?: (typeof BOT_BODIES)[number];
  }>({});
  const [routineId, setRoutineId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const t = useT();
  const routine = routines?.find((found) => found.id === routineId);
  const error = projectNameError(t, name.trim());
  const dirty =
    name !== bot.name ||
    title !== bot.title ||
    instructions !== bot.instructions ||
    look.color !== undefined ||
    look.symbol !== undefined;

  const save = () => {
    void change(bot.id, {
      name: name.trim(),
      title: title.trim(),
      instructions: instructions.trim(),
      ...look,
    });
    onDone();
  };

  if (routine) {
    return (
      <RoutineDetail routine={routine} onBack={() => setRoutineId(undefined)} onChanged={refresh} />
    );
  }

  return (
    <>
      <Dialog.Close
        aria-label={t("Close")}
        className="text-muted-foreground hover:bg-muted hover:text-foreground absolute end-3 top-3 flex size-8 items-center justify-center rounded-full"
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
      </Dialog.Close>
      <Popover>
        <PopoverTrigger aria-label={t("Edit bot avatar")} className="mx-auto my-2 rounded-full">
          <BotAvatar
            color={look.color ?? bot.color}
            body={look.symbol ?? bot.symbol}
            seed={bot.id}
            state="opening"
            className="size-20"
          />
        </PopoverTrigger>
        <PopoverContent
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="z-70 w-80 p-3"
        >
          <BotPickerPanel
            color={look.color ?? bot.color}
            body={look.symbol ?? bot.symbol}
            seed={bot.id}
            onColor={(color) => setLook({ ...look, color })}
            onBody={(symbol) => setLook({ ...look, symbol })}
          />
        </PopoverContent>
      </Popover>
      <Field label={t("Name")} error={error}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={PROJECT_NAME_MAX}
          placeholder={t("Name")}
          aria-invalid={error !== undefined}
          className={cn(fieldClass, "h-11")}
        />
      </Field>
      <Field
        label={
          <>
            {t("Title")} <span className="opacity-70">{t("Optional")}</span>
          </>
        }
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={PROJECT_NAME_MAX}
          placeholder={t("A short role, like Quranic Arabic tutor")}
          className={cn(fieldClass, "h-11")}
        />
      </Field>
      <Field label={t("Description")}>
        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          maxLength={INSTRUCTIONS_MAX}
          placeholder={t("What should this bot do?")}
          rows={4}
          className={cn(fieldClass, "resize-none py-2")}
        />
      </Field>
      {routines && (
        <RoutineList routines={routines} onOpen={setRoutineId} onCreate={() => setCreating(true)} />
      )}
      <button
        type="button"
        disabled={!dirty || error !== undefined || name.trim() === ""}
        onClick={save}
        className={cn(modalPrimaryButton, "self-end rounded-full px-4")}
      >
        {t("Save")}
      </button>
      {creating && (
        <AutomationEditor
          automation={undefined}
          draft={blankDraft()}
          botId={bot.id}
          onClose={() => setCreating(false)}
          onSaved={() => void refresh()}
        />
      )}
    </>
  );
};

export const BotProfile: FC<{ bot: Project }> = ({ bot }) => {
  const open = useBotProfile((s) => s.open);
  const setOpen = useBotProfile((s) => s.setOpen);
  const t = useT();

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="dim fixed inset-0 z-60 bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="pop bg-background ring-foreground/7 fixed top-1/2 left-1/2 z-60 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-135 -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-[20px] p-5 shadow-lg ring-1 outline-none ring-inset"
        >
          <Dialog.Title className="sr-only">{t("Edit profile")}</Dialog.Title>
          <ProfileForm key={bot.id} bot={bot} onDone={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
