"use client";

import { describeSchedule } from "@/components/automationText";
import { EventLine } from "@/components/botEvents";
import { useLocale, useT } from "@/components/i18n";
import { schedule } from "@sirathic/server/automations";
import { CONNECTORS, connectorId } from "@sirathic/server/catalog";
import { type ThreadMessage, useAui } from "@assistant-ui/react";
import { CancelCircleIcon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { type FC, useState } from "react";
import { z } from "zod";

type ToolCall = Extract<ThreadMessage["content"][number], { type: "tool-call" }>;

const routine = z.object({ name: z.string(), prompt: z.string(), schedule });

const install = z.object({ id: connectorId });

const shown = z.union([z.string(), z.number(), z.boolean()]);

const nameOf = (tool: string) => tool.replaceAll(/[_-]+/gu, " ");

const Action: FC<{ call: ToolCall }> = ({ call }) => {
  const t = useT();
  const locale = useLocale();
  const created = routine.safeParse(call.args).data;
  if (created) {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm font-medium">{created.name}</span>
        <span className="text-muted-foreground text-xs">
          {describeSchedule(t, locale, created.schedule)}
        </span>
        <span className="text-muted-foreground line-clamp-3 text-xs">{created.prompt}</span>
      </div>
    );
  }
  const plugin = call.toolName === "install_plugin" ? install.safeParse(call.args).data : undefined;
  if (plugin) {
    const { name, description } = CONNECTORS[plugin.id];
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="text-muted-foreground text-xs">{description}</span>
      </div>
    );
  }
  const rows = Object.entries(call.args);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-sm font-medium first-letter:uppercase">{nameOf(call.toolName)}</span>
      {rows.map(([key, value]) => (
        <span key={key} className="text-muted-foreground line-clamp-3 text-xs wrap-break-word">
          {key}: {shown.safeParse(value).data?.toString() ?? JSON.stringify(value)}
        </span>
      ))}
    </div>
  );
};

export const ConfirmCard: FC<{ call: ToolCall }> = ({ call }) => {
  const aui = useAui();
  const t = useT();
  const [sent, setSent] = useState(false);
  const { approval } = call;
  if (!approval) return null;
  const confirmed = approval.approved === true;
  const closed = approval.approved !== undefined || approval.resolution !== undefined;
  const respond = (approved: boolean) => {
    setSent(true);
    aui
      .message()
      .part({ toolCallId: call.toolCallId })
      .respondToToolApproval({ approved })
      .catch(() => setSent(false));
  };

  const title = nameOf(call.toolName);
  return (
    <>
      <div className="border-foreground/10 bg-background my-3 flex w-full max-w-lg flex-col gap-3 rounded-3xl border px-4 py-3 print:hidden">
        <div className="flex items-start justify-between gap-2">
          <span className="text-muted-foreground text-xs">{t("Confirm this action")}</span>
        </div>
        <Action call={call} />
        {!closed && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={sent}
              onClick={() => respond(true)}
              className="bg-foreground text-background h-8 rounded-full px-3 text-sm font-medium disabled:opacity-50"
            >
              {t("Confirm")}
            </button>
            <button
              type="button"
              disabled={sent}
              onClick={() => respond(false)}
              className="bg-foreground/8 hover:bg-foreground/12 h-8 rounded-full px-3 text-sm font-medium disabled:opacity-50"
            >
              {t("Cancel")}
            </button>
          </div>
        )}
      </div>
      {closed && (
        <EventLine
          icon={confirmed ? CheckmarkCircle02Icon : CancelCircleIcon}
          label={confirmed ? t("Confirmed") : t("Cancelled")}
          name={`${title.charAt(0).toUpperCase()}${title.slice(1)}`}
        />
      )}
    </>
  );
};
