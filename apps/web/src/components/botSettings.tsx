"use client";

import { AutomationEditor } from "@/components/automationEditor";
import { blankDraft } from "@sirathic/app/automationDraft";
import { BotAvatar } from "@/components/botAvatar";
import { BotPickerPanel } from "@/components/botPicker";
import { BotPlugins } from "@/components/botPlugins";
import { BotProgress } from "@/components/botProgress";
import { BrowserPreview } from "@/components/browserView";
import { RoutineDetail, RoutineList, useRoutines } from "@/components/botRoutines";
import { useT } from "@/components/i18n";
import { type Project, projectNameError, useProjects } from "@/components/projects";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PROJECT_NAME_MAX } from "@sirathic/server/projects";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Settings01Icon } from "@hugeicons/core-free-icons";
import { type ChangeEvent, type FC, type ReactNode, useState } from "react";
import { create } from "zustand";

const INSTRUCTIONS_MAX = 4000;

type PanelView = "closed" | "screen" | "settings";

export const useBotPanel = create<{ view: PanelView; show: (view: PanelView) => void }>()(
  (set) => ({
    view: "closed",
    show: (view) => set({ view }),
  }),
);

const fieldClass =
  "bg-card border-border focus-visible:border-foreground/30 w-full rounded-xl border px-3 text-sm outline-none";

const Field: FC<{
  label: ReactNode;
  value: string;
  placeholder: string;
  maxLength: number;
  required?: boolean;
  multiline?: boolean;
  check?: (text: string) => string | undefined;
  onSave: (text: string) => void;
}> = ({ label, value, placeholder, maxLength, required, multiline, check, onSave }) => {
  const [text, setText] = useState(value);
  const error = check?.(text.trim());
  const shared = {
    value: text,
    maxLength,
    placeholder,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setText(event.target.value),
    onBlur: () => {
      const next = text.trim();
      if (next === value || error || (required && next === "")) setText(value);
      else onSave(next);
    },
    "aria-invalid": error !== undefined,
  };

  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground ps-1">{label}</span>
      {multiline ? (
        <textarea {...shared} rows={4} className={`${fieldClass} resize-none py-2`} />
      ) : (
        <input {...shared} className={`${fieldClass} h-11`} />
      )}
      {error && <span className="text-destructive ps-1">{error}</span>}
    </label>
  );
};

const headerButton =
  "text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground flex size-8 items-center justify-center rounded-full";

export const BotPanel: FC<{ bot: Project }> = ({ bot }) => {
  const view = useBotPanel((s) => s.view);
  const show = useBotPanel((s) => s.show);
  const change = useProjects((s) => s.change);
  const { routines, refresh } = useRoutines(bot.id);
  const [routineId, setRoutineId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const routine = routines?.find((found) => found.id === routineId);
  const t = useT();

  if (view === "closed") return null;

  return (
    <aside
      aria-label={view === "screen" ? t("{name}'s screen", { name: bot.name }) : t("Settings")}
      onKeyDown={(event) => event.key === "Escape" && show("closed")}
      className="bg-background border-sidebar-border fixed inset-y-0 end-0 z-50 flex w-full max-w-90 flex-col border-s shadow-lg md:static md:z-auto md:max-w-110 md:shrink-0 md:shadow-none xl:max-w-140 print:hidden"
    >
      <div className="flex h-14 shrink-0 items-center justify-end gap-1 ps-5 pe-3">
        {view === "settings" && <h2 className="me-auto text-base font-medium">{t("Settings")}</h2>}
        <button
          type="button"
          aria-label={t("Settings")}
          aria-pressed={view === "settings"}
          onClick={() => show(view === "settings" ? "screen" : "settings")}
          className={headerButton}
        >
          <HugeiconsIcon icon={Settings01Icon} className="size-4.5" />
        </button>
        <button
          type="button"
          aria-label={t("Close")}
          onClick={() => show("closed")}
          className={headerButton}
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-4.5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-6">
        {routine ? (
          <RoutineDetail
            routine={routine}
            onBack={() => setRoutineId(undefined)}
            onChanged={refresh}
          />
        ) : view === "screen" ? (
          <>
            <BrowserPreview botId={bot.id} name={bot.name} />
            {routines && (
              <RoutineList
                routines={routines}
                onOpen={setRoutineId}
                onCreate={() => setCreating(true)}
              />
            )}
          </>
        ) : (
          <>
            <Popover>
              <PopoverTrigger
                aria-label={t("Edit bot avatar")}
                className="mx-auto my-4 rounded-full"
              >
                <BotAvatar
                  color={bot.color}
                  body={bot.symbol}
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
                  color={bot.color}
                  body={bot.symbol}
                  seed={bot.id}
                  onColor={(color) => void change(bot.id, { color })}
                  onBody={(symbol) => void change(bot.id, { symbol })}
                />
              </PopoverContent>
            </Popover>
            <Field
              key={`name:${bot.name}`}
              label={t("Name")}
              value={bot.name}
              placeholder={t("Name")}
              maxLength={PROJECT_NAME_MAX}
              required
              check={(text) => projectNameError(t, text)}
              onSave={(name) => void change(bot.id, { name })}
            />
            <Field
              key={`title:${bot.title}`}
              label={
                <>
                  {t("Title")} <span className="opacity-70">{t("Optional")}</span>
                </>
              }
              value={bot.title}
              placeholder={t("A short role, like Quranic Arabic tutor")}
              maxLength={PROJECT_NAME_MAX}
              onSave={(title) => void change(bot.id, { title })}
            />
            <Field
              key={`instructions:${bot.instructions}`}
              label={t("Description")}
              value={bot.instructions}
              placeholder={t("What should this bot do?")}
              maxLength={INSTRUCTIONS_MAX}
              multiline
              onSave={(instructions) => void change(bot.id, { instructions })}
            />
            <BotProgress id={bot.id} />
            <BotPlugins id={bot.id} allowed={bot.plugins} />
          </>
        )}
      </div>
      {creating && (
        <AutomationEditor
          automation={undefined}
          draft={blankDraft()}
          botId={bot.id}
          onClose={() => setCreating(false)}
          onSaved={() => void refresh()}
        />
      )}
    </aside>
  );
};
