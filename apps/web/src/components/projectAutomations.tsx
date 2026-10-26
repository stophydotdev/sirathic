"use client";

import { blankDraft, type Draft, draftOf } from "@/components/automationDraft";
import { AutomationEditor } from "@/components/automationEditor";
import { type Automation, describeSchedule } from "@/components/automationText";
import { useLocale, useT } from "@/components/i18n";
import { pill } from "@/components/projectMenu";
import { api } from "@/lib/trpc";
import { type FC, useCallback, useEffect, useState } from "react";

type Editing = { automation: Automation | undefined; draft: Draft };

export const ProjectAutomations: FC<{ projectId: string }> = ({ projectId }) => {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [editing, setEditing] = useState<Editing>();
  const t = useT();
  const locale = useLocale();

  const refresh = useCallback(async () => {
    const found = await api.automations.list.query().catch(() => undefined);
    if (found) setAutomations(found.filter((automation) => automation.projectId === projectId));
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="flex flex-col gap-3 py-4">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="text-sm font-medium">{t("Your automations")}</h3>
          <p className="text-muted-foreground text-[13px]">
            {t("Schedule recurring tasks that run in this project")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing({ automation: undefined, draft: blankDraft() })}
          className={pill}
        >
          {t("Add")}
        </button>
      </div>
      {automations.map((automation) => (
        <button
          key={automation.id}
          type="button"
          onClick={() => setEditing({ automation, draft: draftOf(automation) })}
          className="hover:bg-muted flex min-w-0 flex-col rounded-[10px] px-2.5 py-1.5 text-start"
        >
          <span className="truncate text-sm font-medium">{automation.name}</span>
          <span className="text-muted-foreground truncate text-[13px]">
            {describeSchedule(t, locale, automation.schedule)}
            {!automation.enabled && ` · ${t("Paused")}`}
          </span>
        </button>
      ))}
      {editing && (
        <AutomationEditor
          key={editing.automation?.id ?? "new"}
          automation={editing.automation}
          draft={editing.draft}
          projectId={projectId}
          onClose={() => setEditing(undefined)}
          onSaved={() => void refresh()}
        />
      )}
    </section>
  );
};
