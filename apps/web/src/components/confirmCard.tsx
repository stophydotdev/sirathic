"use client";

import { type ApprovalAnswer, ApprovalPrompt, DetailRows } from "@/components/approvalPrompt";
import { describeSchedule } from "@/components/automationText";
import { useBot } from "@/components/botHome";
import { EventLine } from "@/components/botEvents";
import { EmailCard } from "@/components/emailCard";
import { nameOf, type ToolCall } from "@/components/confirmShell";
import { useLocale, useT } from "@/components/i18n";
import { VaultFillDetails, vaultFill } from "@/components/vaultFillDetails";
import { api } from "@/lib/trpc";
import type { MessageKey } from "@/messages/en";
import { outgoingEmail } from "@sirathic/server/email";
import { schedule } from "@sirathic/server/automations";
import { CONNECTORS, connectorId, toolName } from "@sirathic/server/catalog";
import { type ActionKind, actionOf } from "@sirathic/server/confirm";
import { RULE_CHARS, RULE_LIMIT } from "@sirathic/server/settings";
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

const QUESTIONS = {
  delete: "Allow {name} to delete this?",
  refund: "Allow {name} to issue this refund?",
  pay: "Allow {name} to make this payment?",
  send: "Allow {name} to send this?",
  post: "Allow {name} to post this?",
  cancel: "Allow {name} to cancel this?",
} as const satisfies Record<ActionKind, MessageKey>;

const titleOf = (text: string) => {
  const spaced = nameOf(text.replaceAll(/(\p{Ll})(\p{Lu})/gu, "$1 $2")).toLowerCase();
  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
};

const allowAlways = async (text: string) => {
  const rule = { text: text.slice(0, RULE_CHARS), effect: "allow" as const };
  const { rules } = await api.settings.get.query();
  if (rules.length >= RULE_LIMIT || rules.some((have) => have.text === rule.text)) return;
  await api.settings.update.mutate({ rules: [...rules, rule] });
};

const Details: FC<{ call: ToolCall }> = ({ call }) => {
  const t = useT();
  const locale = useLocale();
  const created = routine.safeParse(call.args).data;
  if (created) {
    return (
      <DetailRows
        rows={[
          [t("Name"), created.name],
          [t("Schedule"), describeSchedule(t, locale, created.schedule)],
          [t("Instructions"), created.prompt],
        ]}
      />
    );
  }
  const plugin = call.toolName === "install_plugin" ? install.safeParse(call.args).data : undefined;
  if (plugin) {
    const { name, description } = CONNECTORS[plugin.id];
    return <DetailRows rows={[[name, description]]} />;
  }
  const fill =
    call.toolName === "vault_fill_contact" ? vaultFill.safeParse(call.args).data : undefined;
  if (fill) return <VaultFillDetails fill={fill} />;
  return (
    <DetailRows
      rows={Object.entries(call.args).map(([key, value]) => {
        const labels = key === "matches" ? matched.safeParse(value).data : undefined;
        return [
          titleOf(key),
          labels
            ? labels.map(({ label }) => label).join("\n")
            : (shown.safeParse(value).data?.toString() ?? JSON.stringify(value)),
        ] as const;
      })}
    />
  );
};

export const ConfirmCard: FC<{ call: ToolCall }> = ({ call }) => {
  const aui = useAui();
  const t = useT();
  const botName = useBot()?.name ?? "Sirathic";
  const [sent, setSent] = useState(false);
  const { approval } = call;
  if (!approval) return null;
  if (approval.isAutomatic) {
    return (
      <EventLine icon={CancelCircleIcon} label={t("Cancelled")} name={titleOf(call.toolName)} />
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

  const fill =
    call.toolName === "vault_fill_contact" ? vaultFill.safeParse(call.args).data : undefined;
  const subject = fill?.domain ?? titleOf(call.toolName);
  if (closed) {
    return (
      <EventLine
        icon={confirmed ? CheckmarkCircle02Icon : CancelCircleIcon}
        label={confirmed ? t("Allowed") : t("Not allowed")}
        name={subject}
      />
    );
  }

  const kind = actionOf({ toolName: call.toolName, input: call.args });
  const question = fill
    ? t("Allow {name} to fill your saved contact on {site}?", { name: botName, site: fill.domain })
    : t(kind ? QUESTIONS[kind] : "Allow {name} to do this?", { name: botName });
  const always = fill ? t("Always allow on this site") : undefined;
  const rule = fill
    ? t("Fill my saved contact on {site} without asking", { site: fill.domain })
    : "";
  const answer = (choice: ApprovalAnswer) => {
    if (choice === "always" && rule) void allowAlways(rule).catch(() => undefined);
    decide(choice !== "never");
  };
  return (
    <ApprovalPrompt
      question={question}
      note={fill ? t("It types these values into the page and doesn't submit it.") : undefined}
      always={always}
      busy={sent}
      onAnswer={answer}
    >
      <Details call={call} />
    </ApprovalPrompt>
  );
};
