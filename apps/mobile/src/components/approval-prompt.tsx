import { CONNECTORS, connectorId } from "@sirathic/server/catalog";
import { actionOf, type ActionKind } from "@sirathic/server/confirm";
import { schedule } from "@sirathic/server/automations";
import type { ChatMessage } from "@sirathic/server/messages";
import { RULE_CHARS, RULE_LIMIT } from "@sirathic/server/settings";
import { type FC, type ReactNode, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { z } from "zod";
import { api } from "@/lib/api";
import { docked, fillOf, PART_NAMES, type Tool, titleOf, vaultFill } from "@/lib/approvals";
import { describeSchedule } from "@/lib/automations";
import { toolOf } from "@/lib/research";
import { Pill } from "./approval-card";
import { AlertTriangle, ChevronDown, ChevronRight } from "./icons";

type Decide = (approvalId: string, approved: boolean) => void;

const routine = z.object({ name: z.string(), prompt: z.string(), schedule });

const install = z.object({ id: connectorId });

const shown = z.union([z.string(), z.number(), z.boolean()]);

const matched = z.array(z.object({ label: z.string() }));

const args = z.record(z.string(), z.json()).catch({});

const WHAT = {
  delete: "delete this",
  refund: "issue this refund",
  pay: "make this payment",
  send: "send this",
  post: "post this",
  cancel: "cancel this",
} as const satisfies Record<ActionKind, string>;

const allowAlways = async (text: string) => {
  const rule = { text: text.slice(0, RULE_CHARS), effect: "allow" as const };
  const { rules } = await api.settings.get.query();
  if (rules.length >= RULE_LIMIT || rules.some((have) => have.text === rule.text)) return;
  await api.settings.update.mutate({ rules: [...rules, rule] });
};

const loadContact = async (label: string) => {
  const { contacts } = await api.vault.list.query();
  const found = contacts.find(
    (contact) => contact.label.trim().toLowerCase() === label.trim().toLowerCase(),
  );
  const item = found ? await api.vault.open.query({ id: found.id }) : undefined;
  return item?.kind === "contact" ? item : null;
};

type Contact = Awaited<ReturnType<typeof loadContact>>;

const DetailRows: FC<{ rows: readonly (readonly [string, ReactNode])[] }> = ({ rows }) => (
  <ScrollView className="bg-background border-foreground/8 max-h-48 rounded-2xl border">
    {rows.map(([label, value], index) => (
      <View
        key={label}
        className={`flex-row items-start gap-3 px-3.5 py-2 ${index > 0 ? "border-foreground/8 border-t" : ""}`}
      >
        <Text className="text-muted-foreground font-sans w-24 text-sm">{label}</Text>
        <Text className="text-foreground font-sans flex-1 text-sm">{value}</Text>
      </View>
    ))}
  </ScrollView>
);

const FillDetails: FC<{ fill: z.infer<typeof vaultFill> }> = ({ fill }) => {
  const [contact, setContact] = useState<Contact | undefined>();
  useEffect(() => {
    void loadContact(fill.label).then(setContact, () => setContact(null));
  }, [fill.label]);
  return (
    <DetailRows
      rows={fill.fields.map(({ part }) => {
        const value = contact?.[part] ?? "";
        return [PART_NAMES[part], contact === undefined ? "…" : value || "-"] as const;
      })}
    />
  );
};

const Details: FC<{ tool: Tool }> = ({ tool }) => {
  const created = routine.safeParse(tool.input).data;
  if (created) {
    return (
      <DetailRows
        rows={[
          ["Name", created.name],
          ["Schedule", describeSchedule(created.schedule)],
          ["Instructions", created.prompt],
        ]}
      />
    );
  }
  const plugin = tool.name === "install_plugin" ? install.safeParse(tool.input).data : undefined;
  if (plugin) {
    const { name, description } = CONNECTORS[plugin.id];
    return <DetailRows rows={[[name, description]]} />;
  }
  const fill = fillOf(tool);
  if (fill) return <FillDetails fill={fill} />;
  return (
    <DetailRows
      rows={Object.entries(args.parse(tool.input)).map(([key, value]) => {
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

const Prompt: FC<{ tool: Tool; name: string; onDecide: Decide }> = ({ tool, name, onDecide }) => {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const fill = fillOf(tool);
  const kind = actionOf({ toolName: tool.name, input: tool.input });
  const question = fill
    ? `Allow ${name} to fill your saved contact on ${fill.domain}?`
    : `Allow ${name} to ${kind ? WHAT[kind] : "do this"}?`;
  const answer = (approved: boolean, always = false) => {
    if (!tool.approval) return;
    if (always && fill) {
      void allowAlways(`Fill my saved contact on ${fill.domain} without asking`).catch(
        () => undefined,
      );
    }
    setBusy(true);
    onDecide(tool.approval.id, approved);
  };
  return (
    <View className="bg-foreground/7 w-full gap-2.5 rounded-3xl px-3.5 pt-3.5 pb-3">
      <View className="flex-row gap-2.5">
        <AlertTriangle
          size={20}
          strokeWidth={1.75}
          colorClassName="accent-amber-600 dark:accent-amber-500"
        />
        <View className="flex-1 gap-0.5">
          <Text className="text-foreground font-medium text-base">{question}</Text>
          {fill && (
            <Text className="text-muted-foreground font-sans text-xs">
              It types these values into the page and doesn't submit it.
            </Text>
          )}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        className="flex-row items-center gap-1 self-start"
      >
        {open ? (
          <ChevronDown size={14} colorClassName="accent-muted-foreground" />
        ) : (
          <ChevronRight size={14} colorClassName="accent-muted-foreground" />
        )}
        <Text className="text-muted-foreground font-sans text-xs">
          {open ? "Hide details" : "Show details"}
        </Text>
      </Pressable>
      {open && <Details tool={tool} />}
      <View className="flex-row flex-wrap gap-2">
        <Pill label="Allow once" tone="primary" disabled={busy} onPress={() => answer(true)} />
        <Pill label="Don't allow" tone="quiet" disabled={busy} onPress={() => answer(false)} />
        {fill && (
          <Pill
            label="Always allow on this site"
            tone="quiet"
            disabled={busy}
            onPress={() => answer(true, true)}
          />
        )}
      </View>
    </View>
  );
};

export const ApprovalDock: FC<{
  message: ChatMessage | undefined;
  name: string;
  onDecide: Decide;
}> = ({ message, name, onDecide }) => {
  const pending = (message?.parts ?? []).flatMap((part) => {
    const tool = toolOf(part);
    return tool && docked(tool) ? [tool] : [];
  });
  if (pending.length === 0) return null;
  return (
    <View className="gap-2 pb-2">
      {pending.map((tool) => (
        <Prompt key={tool.id} tool={tool} name={name} onDecide={onDecide} />
      ))}
    </View>
  );
};
