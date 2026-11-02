"use client";

import { approveAs } from "@/components/approvalVerb";
import { describeSchedule } from "@/components/automationText";
import { EventLine } from "@/components/botEvents";
import { EmailCard } from "@/components/emailCard";
import {
  CardShell,
  dangerPill,
  nameOf,
  primaryPill,
  quietPill,
  Row,
  type ToolCall,
} from "@/components/confirmShell";
import { useLocale, useT } from "@/components/i18n";
import { outgoingEmail } from "@sirathic/server/email";
import { schedule } from "@sirathic/server/automations";
import { CONNECTORS, connectorId, toolName } from "@sirathic/server/catalog";
import { useAui } from "@assistant-ui/react";
import { CancelCircleIcon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { type FC, useState } from "react";
import { z } from "zod";

const routine = z.object({ name: z.string(), prompt: z.string(), schedule });

const install = z.object({ id: connectorId });

const shown = z.union([z.string(), z.number(), z.boolean()]);

const matched = z.array(z.object({ label: z.string() }));

const sentEmail = z.object({ to: z.array(z.string()) });

const GMAIL_SEND = toolName("gmail", "send_email");

const Details: FC<{ call: ToolCall }> = ({ call }) => {
  const t = useT();
  const locale = useLocale();
  const created = routine.safeParse(call.args).data;
  if (created) {
    return (
      <div className="flex min-w-0 flex-col gap-1 px-3.5 py-3">
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
      <div className="flex min-w-0 flex-col gap-1 px-3.5 py-3">
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="text-muted-foreground text-xs">{description}</span>
      </div>
    );
  }
  return Object.entries(call.args).map(([key, value]) => {
    const labels = key === "matches" ? matched.safeParse(value).data : undefined;
    return (
      <Row key={key} label={nameOf(key)}>
        <span
          className={`${call.toolName === "send_feedback" || labels ? "" : "line-clamp-6"} ${labels ? "max-h-64 overflow-y-auto" : ""} min-w-0 flex-1 py-1.5 wrap-break-word whitespace-pre-line`}
        >
          {labels
            ? labels.map(({ label }) => label).join("\n")
            : (shown.safeParse(value).data?.toString() ?? JSON.stringify(value))}
        </span>
      </Row>
    );
  });
};

export const ConfirmCard: FC<{ call: ToolCall }> = ({ call }) => {
  const aui = useAui();
  const t = useT();
  const [sent, setSent] = useState(false);
  const { approval } = call;
  if (!approval) return null;
  if (approval.isAutomatic) {
    return (
      <EventLine icon={CancelCircleIcon} label={t("Cancelled")} name={nameOf(call.toolName)} />
    );
  }
  const confirmed = approval.approved === true;
  const closed = approval.approved !== undefined || approval.resolution !== undefined;
  const decide = (approved: boolean) => {
    setSent(true);
    aui
      .message()
      .part({ toolCallId: call.toolCallId })
      .respondToToolApproval({ approved })
      .catch(() => setSent(false));
  };

  const email = call.toolName === GMAIL_SEND ? outgoingEmail.safeParse(call.args).data : undefined;
  if (email) {
    const sending = confirmed && call.result === undefined;
    if (!closed || sending) {
      return <EmailCard call={call} email={email} busy={sent || sending} decide={decide} />;
    }
    const to = sentEmail.safeParse(call.result).data?.to;
    return (
      <EventLine
        icon={to && !call.isError ? CheckmarkCircle02Icon : CancelCircleIcon}
        label={
          !confirmed
            ? t("Discarded")
            : to && !call.isError
              ? t("Sent to {to}", { to: to.join(", ") })
              : t("Not sent")
        }
      />
    );
  }

  const title = nameOf(call.toolName);
  const verb = approveAs(call);
  return (
    <>
      <CardShell
        title={title}
        status={t("Needs your OK")}
        actions={
          !closed && (
            <>
              <button
                type="button"
                disabled={sent}
                onClick={() => decide(true)}
                className={verb.danger ? dangerPill : primaryPill}
              >
                {t(verb.label)}
              </button>
              <button
                type="button"
                disabled={sent}
                onClick={() => decide(false)}
                className={quietPill}
              >
                {t("Cancel")}
              </button>
            </>
          )
        }
      >
        <Details call={call} />
      </CardShell>
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
