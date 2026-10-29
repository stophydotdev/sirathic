"use client";

import { AutomationEditor } from "@/components/automationEditor";
import { blankDraft } from "@sirathic/app/automationDraft";
import { BotPlugins } from "@/components/botPlugins";
import { BotProgress } from "@/components/botProgress";
import { BrowserPreview } from "@/components/browserView";
import { RoutineDetail, RoutineList, useRoutines } from "@/components/botRoutines";
import { useT } from "@/components/i18n";
import type { Project } from "@/components/projects";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Settings01Icon } from "@hugeicons/core-free-icons";
import { type FC, useState } from "react";
import { create } from "zustand";

type PanelView = "closed" | "screen" | "settings";

export const useBotPanel = create<{ view: PanelView; show: (view: PanelView) => void }>()(
  (set) => ({
    view: "closed",
    show: (view) => set({ view }),
  }),
);

const headerButton =
  "text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground flex size-8 items-center justify-center rounded-full";

export const BotPanel: FC<{ bot: Project }> = ({ bot }) => {
  const view = useBotPanel((s) => s.view);
  const show = useBotPanel((s) => s.show);
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
