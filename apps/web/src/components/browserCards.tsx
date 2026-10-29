"use client";

import { useBot } from "@/components/botHome";
import { useBrowser } from "@/components/browserView";
import { useChatState } from "@/components/chat";
import { primaryPill, quietPill } from "@/components/confirmShell";
import { useT } from "@/components/i18n";
import { browserHelp, filled, userForm } from "@sirathic/browser/protocol";
import { messageMetadata } from "@sirathic/server/messages";
import { useAuiState } from "@assistant-ui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ComputerIcon, Shield01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { type FC, type ReactNode, useState } from "react";
import { z } from "zod";

type FormReply = NonNullable<z.infer<typeof messageMetadata>["formReply"]>;

const notShown = z.object({ shown: z.literal(false) });

const useReply = () =>
  useAuiState((s) => {
    const at = s.thread.messages.findIndex((message) => message.id === s.message.id);
    const reply = s.thread.messages.slice(at + 1).find((message) => message.role === "user");
    if (!reply) return undefined;
    return messageMetadata.safeParse(reply.metadata.custom).data?.formReply ?? "answered";
  });

const Status: FC<{ tone: "done" | "waiting" | "quiet"; children: ReactNode }> = ({
  tone,
  children,
}) => (
  <span
    className={`flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${
      tone === "done"
        ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
        : tone === "waiting"
          ? "bg-amber-500/12 text-amber-700 dark:text-amber-400"
          : "bg-foreground/8 text-muted-foreground"
    }`}
  >
    {children}
  </span>
);

const Receipt: FC<{ title: string; reply: FormReply | "answered" }> = ({ title, reply }) => {
  const t = useT();
  return (
    <div className="bot-card flex items-center gap-3 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium">{title}</p>
        {reply === "filled" && (
          <p className="text-muted-foreground text-sm">
            {t("Filled into the page. Your bot never saw it.")}
          </p>
        )}
        {reply === "missed" && (
          <p className="text-muted-foreground text-sm">{t("Some fields didn't fill.")}</p>
        )}
      </div>
      {reply === "filled" && (
        <Status tone="done">
          <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
          {t("Filled")}
        </Status>
      )}
      {reply === "dismissed" && <Status tone="quiet">{t("Dismissed")}</Status>}
    </div>
  );
};

export const FormCard: FC<{ args: unknown; result: unknown }> = ({ args, result }) => {
  const form = userForm.safeParse(args).data;
  const bot = useBot();
  const chat = useChatState()?.chat;
  const reply = useReply();
  const running = useAuiState((s) => s.thread.isRunning);
  const show = useBrowser((s) => s.show);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [keep, setKeep] = useState(false);
  const t = useT();
  if (!form || !bot || notShown.safeParse(result).success) return null;
  if (reply) return <Receipt title={form.title} reply={reply} />;
  const login =
    form.reason === "auth" &&
    form.fields.some((field) => field.secret) &&
    form.fields.some((field) => !field.secret);
  const complete = form.fields.every(({ target }) => (values[target] ?? "") !== "");

  const send = (text: string, formReply: FormReply) =>
    void chat?.sendMessage({ text, metadata: { createdAt: Date.now(), formReply } });

  const fillIn = async () => {
    setBusy(true);
    setFailed(false);
    const response = await fetch(`/api/bots/${bot.id}/browser/fill`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fields: form.fields.map(({ target, secret }) => ({
          target,
          value: values[target] ?? "",
          secret,
        })),
        submit: form.submit ?? false,
        domain: form.domain,
        save: login && keep,
      }),
    }).catch(() => undefined);
    const receipt = response?.ok ? filled.safeParse(await response.json()).data : undefined;
    setBusy(false);
    if (!receipt) {
      setFailed(true);
      return;
    }
    setValues({});
    const missed = form.fields.filter(({ target }) =>
      receipt.fields.some((field) => field.target === target && !field.filled),
    );
    if (missed.length === 0) send(t("I filled in the form."), "filled");
    else {
      send(
        t("These fields didn't fill: {fields}.", {
          fields: missed.map(({ label }) => label).join(", "),
        }),
        "missed",
      );
    }
  };

  return (
    <form
      className="bot-card flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && !running && complete) void fillIn();
      }}
    >
      <p className="text-base font-medium">{form.title}</p>
      {form.fields.map(({ label, target, secret }) => (
        <label key={target} className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground ps-1">{label} *</span>
          <input
            type={secret ? "password" : "text"}
            required
            autoComplete="off"
            value={values[target] ?? ""}
            onChange={(event) => setValues({ ...values, [target]: event.target.value })}
            className="bg-background h-11 rounded-xl px-3 text-base outline-none"
          />
        </label>
      ))}
      {login && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={keep}
            onChange={(event) => setKeep(event.target.checked)}
            className="size-4"
          />
          {t("Save to my vault")}
        </label>
      )}
      {failed && <p className="text-destructive text-sm">{t("Couldn't fill the page.")}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy || running || !complete} className={primaryPill}>
          {t("Continue")}
        </button>
        <button type="button" onClick={show} className={quietPill}>
          {t("Open the browser")}
        </button>
        <button
          type="button"
          disabled={running}
          onClick={() => send(t("I dismissed the form."), "dismissed")}
          className="text-muted-foreground hover:text-foreground h-11 px-3 text-sm font-medium disabled:opacity-50"
        >
          {t("Dismiss")}
        </button>
      </div>
      <p className="text-muted-foreground flex gap-2 text-xs">
        <HugeiconsIcon icon={Shield01Icon} className="size-4 shrink-0" />
        {t("Never shown to your bot. Filled directly to {site}.", { site: form.domain })}
      </p>
    </form>
  );
};

export const HelpCard: FC<{ args: unknown }> = ({ args }) => {
  const help = browserHelp.safeParse(args).data;
  const replied = useReply() !== undefined;
  const show = useBrowser((s) => s.show);
  const t = useT();
  if (!help) return null;
  return (
    <div className="bot-card flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-base font-medium">{t("Browser")}</span>
        {replied ? (
          <Status tone="done">
            <span className="size-1.5 rounded-full bg-current" />
            {t("Done")}
          </Status>
        ) : (
          <Status tone="waiting">
            <span className="size-1.5 rounded-full bg-current" />
            {t("Waiting for you")}
          </Status>
        )}
      </div>
      <p className="text-base">{help.instruction}</p>
      <button
        type="button"
        onClick={show}
        className="border-foreground/14 hover:bg-foreground/6 flex h-10 items-center gap-2 self-start rounded-xl border px-3.5 text-sm font-medium"
      >
        <HugeiconsIcon icon={ComputerIcon} className="size-4" />
        {t("Open the browser")}
      </button>
    </div>
  );
};
