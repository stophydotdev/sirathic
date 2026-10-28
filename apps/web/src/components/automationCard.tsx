"use client";

import { describeSchedule } from "@/components/automationText";
import { EventLine } from "@/components/botEvents";
import { FILE_TOOLS } from "@/components/fileCards";
import { type Translate, useLocale, useT } from "@/components/i18n";
import { PluginCard } from "@/components/pluginCard";
import { useProjects } from "@/components/projects";
import { schedule } from "@sirathic/server/automations";
import { currentToolName } from "@sirathic/server/messages";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon, TimeScheduleIcon, UserEdit01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { type FC, useEffect } from "react";
import { z } from "zod";

const CARD_TOOLS = new Set([
  "update_routine",
  "list_routines",
  "set_bot_job",
  "update_profile",
  "install_plugin",
  "clarifying_questions",
  ...FILE_TOOLS,
]);

export const isCardTool = (name: string) => CARD_TOOLS.has(currentToolName(name));

const renamed = z.object({ name: z.string() });

const ACTIONS = ["create", "edit", "pause", "resume", "delete"] as const;

const row = z.object({
  id: z.string(),
  name: z.string(),
  schedule,
  enabled: z.boolean(),
  projectId: z.string().nullish(),
});

const changed = row.partial().extend({
  action: z.enum(ACTIONS).catch("create"),
  id: z.string(),
  name: z.string(),
});

type Row = z.infer<typeof row>;

const RowLine: FC<{ automation: Row }> = ({ automation }) => {
  const t = useT();
  const locale = useLocale();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="bg-muted grid size-8 shrink-0 place-items-center rounded-[8px]">
        <HugeiconsIcon icon={TimeScheduleIcon} className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{automation.name}</span>
        <span className="text-muted-foreground truncate text-xs">
          {describeSchedule(t, locale, automation.schedule)}
        </span>
      </span>
      {!automation.enabled && <span className="text-muted-foreground text-xs">{t("Paused")}</span>}
    </div>
  );
};

const OpenLink: FC = () => {
  const t = useT();
  return (
    <Link
      href="/automations"
      className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-0.5 text-xs transition-colors"
    >
      {t("Open")}
      <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3.5 rtl:-scale-x-100" />
    </Link>
  );
};

const done = (t: Translate, action: (typeof ACTIONS)[number]) =>
  ({
    create: t("Created routine"),
    edit: t("Updated routine"),
    pause: t("Paused routine"),
    resume: t("Resumed routine"),
    delete: t("Deleted routine"),
  })[action];

export const AutomationCard: FC<{ tool: string; result: unknown }> = ({ tool, result }) => {
  const t = useT();
  const made = row.safeParse(result).data;
  const change = changed.safeParse(result).data;
  const bot = renamed.safeParse(result).data;
  const name = currentToolName(tool);
  if ((name === "set_bot_job" || name === "update_profile") && bot)
    return <BotRenamed name={bot.name} />;
  if (name === "update_routine" && change && (made?.projectId || change.action !== "create")) {
    return (
      <EventLine
        icon={TimeScheduleIcon}
        label={done(t, change.action)}
        name={change.name}
        href={change.action === "delete" ? undefined : "/automations"}
      />
    );
  }
  if (name === "update_routine" && made) {
    return (
      <div className="border-border my-3 flex flex-col gap-2 rounded-[12px] border p-3 print:hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs">{t("Automation created")}</span>
          <OpenLink />
        </div>
        <RowLine automation={made} />
      </div>
    );
  }
  if (name === "install_plugin") return <PluginCard result={result} />;
  return null;
};

const BotRenamed: FC<{ name: string }> = ({ name }) => {
  const t = useT();
  useEffect(() => {
    void useProjects.getState().refresh();
  }, [name]);
  return <EventLine icon={UserEdit01Icon} label={t("Renamed to {name}", { name })} />;
};
