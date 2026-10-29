"use client";

import { useT } from "@/components/i18n";
import { control, Group, Row } from "@/components/settingsControls";
import { api } from "@/lib/trpc";
import { type FC, type FormEvent, useEffect, useState } from "react";

type Vault = Awaited<ReturnType<typeof api.vault.list.query>>;

const inputClass =
  "bg-foreground/6 focus-visible:bg-foreground/10 h-10 rounded-xl px-3 text-sm outline-none";

const blank = { site: "", username: "", password: "", code: "" };

const OnePassword: FC<{ connected: boolean; onChange: () => Promise<void> }> = ({
  connected,
  onChange,
}) => {
  const [token, setToken] = useState("");
  const [failed, setFailed] = useState(false);
  const t = useT();
  if (connected) {
    return (
      <Row label="1Password" hint={t("Connected")}>
        <button
          type="button"
          onClick={() => void api.vault.disconnectOnePassword.mutate().then(onChange)}
          className={control}
        >
          {t("Disconnect")}
        </button>
      </Row>
    );
  }
  const connect = async (event: FormEvent) => {
    event.preventDefault();
    setFailed(false);
    const done = await api.vault.connectOnePassword.mutate({ token }).then(
      () => true,
      () => false,
    );
    if (!done) {
      setFailed(true);
      return;
    }
    setToken("");
    await onChange();
  };
  return (
    <form onSubmit={(event) => void connect(event)} className="flex flex-col gap-2 py-2">
      <span className="text-sm font-medium">1Password</span>
      <p className="text-muted-foreground text-xs">
        {t(
          "Create a 1Password service account that can read the vault with the logins your bots may use, then paste its token here.",
        )}
      </p>
      <input
        type="password"
        required
        aria-label={t("Service account token")}
        placeholder={t("Service account token")}
        autoComplete="off"
        value={token}
        onChange={(event) => setToken(event.target.value)}
        className={inputClass}
      />
      {failed && (
        <p className="text-destructive text-sm">{t("1Password didn't accept that token.")}</p>
      )}
      <button type="submit" className={`${control} self-start`}>
        {t("Connect 1Password")}
      </button>
    </form>
  );
};

export const VaultSection: FC = () => {
  const [vault, setVault] = useState<Vault>();
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = useT();

  const load = () =>
    api.vault.list.query().then(setVault, () => {
      setVault({ logins: [], onePassword: false });
    });

  useEffect(() => {
    void load();
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    const saved = await api.vault.save
      .mutate({ ...draft, code: draft.code.trim() || undefined })
      .then(
        () => true,
        () => false,
      );
    setBusy(false);
    if (!saved) {
      setFailed(true);
      return;
    }
    setDraft(blank);
    await load();
  };

  const field = (key: keyof typeof blank, placeholder: string, type = "text") => (
    <input
      type={type}
      required={key !== "code"}
      aria-label={placeholder}
      placeholder={placeholder}
      autoComplete="off"
      value={draft[key]}
      onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
      className={inputClass}
    />
  );

  return (
    <>
      <Group>
        <p className="text-muted-foreground py-2 text-sm">
          {t("Logins your bots can sign in with. They never see them.")}
        </p>
        {vault?.logins.length === 0 && (
          <p className="text-muted-foreground py-3 text-sm">{t("No saved logins yet.")}</p>
        )}
        {vault?.logins.map((login) => (
          <Row
            key={login.id}
            label={login.site}
            hint={login.twoStep ? `${login.username} · ${t("Two-step on")}` : login.username}
          >
            <button
              type="button"
              onClick={() => void api.vault.remove.mutate({ id: login.id }).then(load)}
              className={control}
            >
              {t("Remove")}
            </button>
          </Row>
        ))}
      </Group>
      <Group>
        <form onSubmit={(event) => void save(event)} className="flex flex-col gap-2 py-2">
          {field("site", t("Website"))}
          {field("username", t("Username or email"))}
          {field("password", t("Password"), "password")}
          {field("code", `${t("Two-step setup key")} (${t("Optional")})`)}
          <p className="text-muted-foreground text-xs">{t("Your bots enter the code for you.")}</p>
          {failed && (
            <p className="text-destructive text-sm">
              {t("Could not save your changes. Try again.")}
            </p>
          )}
          <button type="submit" disabled={busy} className={`${control} self-start`}>
            {t("Save login")}
          </button>
        </form>
      </Group>
      {vault && (
        <Group>
          <OnePassword connected={vault.onePassword} onChange={load} />
        </Group>
      )}
    </>
  );
};
