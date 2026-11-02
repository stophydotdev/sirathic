import { outgoingEmail } from "@sirathic/server/email";
import type { FC, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { z } from "zod";
import { emailOf, fillOf, type Tool, titleOf } from "@/lib/approvals";
import { EventLine } from "./chat-cards";
import { Check, X } from "./icons";

type Decide = (approvalId: string, approved: boolean) => void;

const sentEmail = z.object({ to: z.array(z.string()) });

const pill = "h-11 items-center justify-center rounded-full px-5";

const TONES = {
  primary: { pill: "bg-foreground", text: "text-background" },
  quiet: { pill: "bg-foreground/10", text: "text-foreground" },
} as const;

export const Pill: FC<{
  label: string;
  tone: keyof typeof TONES;
  onPress: () => void;
  disabled?: boolean;
}> = ({ label, tone, onPress, disabled }) => (
  <Pressable
    accessibilityRole="button"
    disabled={disabled}
    onPress={onPress}
    className={`${pill} ${TONES[tone].pill} disabled:opacity-50`}
  >
    <Text className={`font-medium text-sm ${TONES[tone].text}`}>{label}</Text>
  </Pressable>
);

const Row: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <View className="flex-row items-start gap-3 px-3.5 py-2.5">
    <Text className="text-muted-foreground font-sans w-16 text-sm">{label}</Text>
    <Text className="text-foreground font-sans flex-1 text-sm">{children}</Text>
  </View>
);

const Shell: FC<{
  title: string;
  status: string;
  actions?: ReactNode;
  children: ReactNode;
}> = ({ title, status, actions, children }) => (
  <View className="bg-foreground/7 my-3 w-full gap-2.5 rounded-3xl px-2.5 pt-3.5 pb-2.5">
    <View className="flex-row items-baseline justify-between gap-2 px-1">
      <Text className="text-foreground font-semibold text-base capitalize">{title}</Text>
      <Text className="text-muted-foreground font-sans text-xs">{status}</Text>
    </View>
    <View className="bg-background border-foreground/8 overflow-hidden rounded-2xl border">
      {children}
    </View>
    {actions && <View className="flex-row flex-wrap gap-2 px-1 pb-1">{actions}</View>}
  </View>
);

const EmailCard: FC<{
  email: z.infer<typeof outgoingEmail>;
  decide?: (approved: boolean) => void;
}> = ({ email, decide }) => (
  <Shell
    title="New email"
    status={decide ? "Ready to send" : "Sending…"}
    actions={
      decide && (
        <>
          <Pill label="Send email" tone="primary" onPress={() => decide(true)} />
          <Pill label="Discard" tone="quiet" onPress={() => decide(false)} />
        </>
      )
    }
  >
    <Row label="Send to">{email.to.join(", ")}</Row>
    {email.cc && email.cc.length > 0 && <Row label="Cc">{email.cc.join(", ")}</Row>}
    {email.bcc && email.bcc.length > 0 && <Row label="Bcc">{email.bcc.join(", ")}</Row>}
    <Row label="Subject">{email.subject}</Row>
    <View className="px-3.5 py-2.5">
      <Text className="text-foreground font-sans text-sm">{email.body}</Text>
    </View>
  </Shell>
);

export const ApprovalCard: FC<{ tool: Tool; onDecide?: Decide }> = ({ tool, onDecide }) => {
  const { approval } = tool;
  if (!approval) return null;
  const confirmed = approval.approved === true;
  const closed = approval.approved !== undefined || !onDecide;
  const decide = onDecide && ((approved: boolean) => onDecide(approval.id, approved));
  if (approval.isAutomatic)
    return <EventLine Icon={X} label="Cancelled" name={titleOf(tool.name)} />;

  const email = emailOf(tool);
  if (email) {
    const sending = confirmed && tool.output === undefined && !tool.failed;
    if (!closed || sending) return <EmailCard email={email} decide={closed ? undefined : decide} />;
    const to = sentEmail.safeParse(tool.output).data?.to;
    const sent = to !== undefined && !tool.failed;
    return (
      <EventLine
        Icon={sent ? Check : X}
        label={!confirmed ? "Discarded" : sent ? `Sent to ${to.join(", ")}` : "Not sent"}
      />
    );
  }

  if (!closed) return null;
  return (
    <EventLine
      Icon={confirmed ? Check : X}
      label={confirmed ? "Allowed" : "Not allowed"}
      name={fillOf(tool)?.domain ?? titleOf(tool.name)}
    />
  );
};
