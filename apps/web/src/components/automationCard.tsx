"use client";

import { describeSchedule } from "@/components/automationText";
import { useLocale, useT } from "@/components/i18n";
import { useProjects } from "@/components/projects";
import { schedule } from "@sirathic/server/automations";
import { IconArrowUpRight, IconClockPlay } from "@tabler/icons-react";
import Link from "next/link";
import { type FC, useEffect } from "react";
import { z } from "zod";

const CARD_TOOLS = new Set(["createAutomation", "listAutomations", "setBotJob", "askUser"]);

export const isCardTool = (name: string) => CARD_TOOLS.has(name);

const renamed = z.object({ name: z.string() });

const row = z.object({
  id: z.string(),
  name: z.string(),
  schedule,
  enabled: z.boolean(),
  projectId: z.string().nullish(),
});

type Row = z.infer<typeof row>;

const RowLine: FC<{ automation: Row }> = ({ automation }) => {
  const t = useT();
  const locale = useLocale();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="bg-muted grid size-8 shrink-0 place-items-center rounded-[8px]">
        <IconClockPlay className="size-4" />
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
      <IconArrowUpRight className="size-3.5 rtl:-scale-x-100" />
    </Link>
  );
};

export const AutomationCard: FC<{ tool: string; result: unknown }> = ({ tool, result }) => {
  const t = useT();
  const created = row.safeParse(result).data;
  const listed = z.array(row).safeParse(result).data;
  const bot = renamed.safeParse(result).data;
  if (tool === "setBotJob" && bot) return <BotRenamed name={bot.name} />;
  if (tool === "createAutomation" && created?.projectId) {
    return (
      <p className="text-muted-foreground my-3 flex items-center justify-center gap-1.5 text-xs">
        {t("Created routine")}
        <IconClockPlay className="size-3.5" />
        <span className="text-foreground">{created.name}</span>
      </p>
    );
  }
  if (tool === "createAutomation" && created) {
    return (
      <div className="border-border my-3 flex flex-col gap-2 rounded-[12px] border p-3 print:hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs">{t("Automation created")}</span>
          <OpenLink />
        </div>
        <RowLine automation={created} />
      </div>
    );
  }
  if (tool === "listAutomations" && listed) {
    return (
      <div className="border-border my-3 flex flex-col gap-2.5 rounded-[12px] border p-3 print:hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs">{t("Your automations")}</span>
          <OpenLink />
        </div>
        {listed.length === 0 && (
          <span className="text-muted-foreground text-sm">{t("No automations yet")}</span>
        )}
        {listed.map((automation) => (
          <RowLine key={automation.id} automation={automation} />
        ))}
      </div>
    );
  }
  return null;
};

const BotRenamed: FC<{ name: string }> = ({ name }) => {
  const t = useT();
  useEffect(() => {
    void useProjects.getState().refresh();
  }, [name]);
  return (
    <p className="text-muted-foreground my-3 text-center text-xs">
      {t("Renamed to {name}", { name })}
    </p>
  );
};
