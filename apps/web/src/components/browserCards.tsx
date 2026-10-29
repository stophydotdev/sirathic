"use client";

import { useBot } from "@/components/botHome";
import { useBrowser } from "@/components/browserView";
import { primaryPill, quietPill } from "@/components/confirmShell";
import { useT } from "@/components/i18n";
import { getFaviconUrl } from "@/lib/favicon";
import { browserHelp, filled, userForm } from "@sirathic/browser/protocol";
import { useAui, useAuiState } from "@assistant-ui/react";
import { type FC, useState } from "react";

const useAnswered = () =>
  useAuiState((s) => {
    const at = s.thread.messages.findIndex((message) => message.id === s.message.id);
    return s.thread.messages.slice(at + 1).some((message) => message.role === "user");
  });

const SiteTitle: FC<{ domain: string; title: string }> = ({ domain, title }) => (
  <div className="flex items-center gap-2">
    <img
      src={getFaviconUrl(`https://${domain}`) ?? undefined}
      alt=""
      onError={(event) => {
        event.currentTarget.hidden = true;
      }}
      className="size-5 shrink-0 rounded"
    />
    <span className="min-w-0 flex-1 truncate text-base font-medium">{title}</span>
  </div>
);

export const FormCard: FC<{ args: unknown }> = ({ args }) => {
  const form = userForm.safeParse(args).data;
  const bot = useBot();
  const aui = useAui();
  const answered = useAnswered();
  const running = useAuiState((s) => s.thread.isRunning);
  const show = useBrowser((s) => s.show);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [keep, setKeep] = useState(false);
  const t = useT();
  if (!form || !bot) return null;
  const login =
    form.reason === "auth" &&
    form.fields.some((field) => field.secret) &&
    form.fields.some((field) => !field.secret);
  if (answered) return <p className="bot-bubble my-2">{form.title}</p>;

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
    aui.thread().append(
      missed.length === 0
        ? t("I filled in the form.")
        : t("These fields didn't fill: {fields}.", {
            fields: missed.map(({ label }) => label).join(", "),
          }),
    );
  };

  return (
    <form
      className="bot-card flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && !running) void fillIn();
      }}
    >
      <SiteTitle domain={form.domain} title={form.title} />
      <p className="text-muted-foreground text-sm">
        {t("Never shown to your bot. Filled directly to {site}.", { site: form.domain })}
      </p>
      {form.fields.map(({ label, target, secret }) => (
        <label key={target} className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground ps-1">{label}</span>
          <input
            type={secret ? "password" : "text"}
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
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || running} className={primaryPill}>
          {t("Fill in")}
        </button>
        <button type="button" onClick={() => show(true)} className={quietPill}>
          {t("Open the browser")}
        </button>
      </div>
    </form>
  );
};

export const HelpCard: FC<{ args: unknown }> = ({ args }) => {
  const help = browserHelp.safeParse(args).data;
  const aui = useAui();
  const answered = useAnswered();
  const running = useAuiState((s) => s.thread.isRunning);
  const show = useBrowser((s) => s.show);
  const t = useT();
  if (!help) return null;
  if (answered) return <p className="bot-bubble my-2">{help.instruction}</p>;
  return (
    <div className="bot-card flex flex-col gap-3">
      {help.domain ? (
        <SiteTitle domain={help.domain} title={help.instruction} />
      ) : (
        <p className="text-base font-medium">{help.instruction}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => show(true)} className={primaryPill}>
          {t("Open the browser")}
        </button>
        <button
          type="button"
          disabled={running}
          onClick={() => aui.thread().append(t("I'm done"))}
          className={quietPill}
        >
          {t("I'm done")}
        </button>
        <button
          type="button"
          disabled={running}
          onClick={() => aui.thread().append(t("Skip this step"))}
          className={quietPill}
        >
          {t("Skip this step")}
        </button>
      </div>
    </div>
  );
};
