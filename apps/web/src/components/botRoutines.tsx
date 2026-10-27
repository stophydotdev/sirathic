"use client";

import { type Automation, describeSchedule, formatInstant } from "@/components/automationText";
import { useLocale, useT } from "@/components/i18n";
import { modalButton } from "@/components/sessionMenu";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft02Icon,
  ArrowRight01Icon,
  Clock01Icon,
  PauseIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { type FC, type ReactNode, useCallback, useEffect, useState } from "react";

export const useRoutines = (botId: string | undefined) => {
  const [routines, setRoutines] = useState<Automation[]>();

  const refresh = useCallback(async () => {
    if (botId === undefined) return;
    const found = await api.automations.list.query().catch(() => undefined);
    if (found) setRoutines(found.filter((routine) => routine.projectId === botId));
  }, [botId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { routines, refresh };
};

export const RoutineList: FC<{ routines: Automation[]; onOpen: (id: string) => void }> = ({
  routines,
  onOpen,
}) => {
  const t = useT();
  const locale = useLocale();

  return (
    <section className="flex flex-col gap-1">
      <h3 className="mb-1 text-sm font-medium">{t("Routines")}</h3>
      {routines.length === 0 && (
        <p className="text-muted-foreground text-[13px]">{t("No routines yet")}</p>
      )}
      {routines.map((routine) => (
        <button
          key={routine.id}
          type="button"
          onClick={() => onOpen(routine.id)}
          className="hover:bg-muted -mx-2 flex items-center gap-3 rounded-[10px] px-2 py-2 text-start"
        >
          <HugeiconsIcon icon={Clock01Icon} className="text-muted-foreground size-4.5 shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{routine.name}</span>
            <span className="text-muted-foreground flex items-center gap-1.5 text-[13px]">
              <span className="truncate">{describeSchedule(t, locale, routine.schedule)}</span>
              {!routine.enabled && (
                <span className="flex shrink-0 items-center gap-1">
                  <HugeiconsIcon icon={PauseIcon} className="size-3.5" />
                  {t("Paused")}
                </span>
              )}
            </span>
          </span>
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className="text-muted-foreground size-4 shrink-0 rtl:rotate-180"
          />
        </button>
      ))}
    </section>
  );
};

const Row: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
    <span className="text-muted-foreground shrink-0">{label}</span>
    <span className="min-w-0 text-end">{children}</span>
  </div>
);

export const RoutineDetail: FC<{
  routine: Automation;
  onBack: () => void;
  onChanged: () => Promise<void>;
}> = ({ routine, onBack, onChanged }) => {
  const [confirming, setConfirming] = useState(false);
  const t = useT();
  const locale = useLocale();

  const toggle = async () => {
    await api.automations.update
      .mutate({ id: routine.id, enabled: !routine.enabled })
      .catch(() => undefined);
    await onChanged();
  };

  const remove = async () => {
    await api.automations.remove.mutate({ id: routine.id }).catch(() => undefined);
    await onChanged();
    onBack();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("Back")}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-full"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4.5 rtl:rotate-180" />
        </button>
        <h3 className="min-w-0 truncate text-[15px] font-[550]">{routine.name}</h3>
      </div>
      <div className="divide-foreground/10 flex flex-col divide-y">
        <Row label={t("Schedule")}>{describeSchedule(t, locale, routine.schedule)}</Row>
        <Row label={t("Status")}>
          <span className="inline-flex items-center gap-1.5">
            {!routine.enabled && <HugeiconsIcon icon={PauseIcon} className="size-3.5" />}
            {routine.enabled ? t("Active") : t("Paused")}
          </span>
        </Row>
        <Row label={t("Next run")}>
          {routine.enabled && routine.nextRunAt
            ? formatInstant(locale, routine.nextRunAt)
            : t("None")}
        </Row>
      </div>
      <div className="flex flex-col gap-1.5">
        <h4 className="text-muted-foreground text-sm">{t("Instructions")}</h4>
        <p className="bg-foreground/3 max-h-48 overflow-y-auto rounded-[10px] px-3 py-2 text-sm whitespace-pre-wrap">
          {routine.prompt}
        </p>
      </div>
      <div className="divide-foreground/10 flex flex-col divide-y">
        <Row label={t("Last run")}>
          {routine.lastRunAt ? formatInstant(locale, routine.lastRunAt) : t("Never")}
        </Row>
      </div>
      {confirming ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            {t('Delete the routine "{name}"?', { name: routine.name })}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirming(false)} className={modalButton}>
              {t("Cancel")}
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              className={cn(modalButton, "bg-destructive border-transparent text-white")}
            >
              {t("Delete")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={cn(modalButton, "text-destructive border-destructive/40")}
          >
            {t("Delete")}
          </button>
          <button
            type="button"
            onClick={() => void toggle()}
            className={cn(modalButton, "gap-1.5")}
          >
            {routine.enabled ? (
              <HugeiconsIcon icon={PauseIcon} className="size-4" />
            ) : (
              <HugeiconsIcon icon={PlayIcon} className="size-4" />
            )}
            {routine.enabled ? t("Pause") : t("Resume")}
          </button>
        </div>
      )}
    </div>
  );
};
