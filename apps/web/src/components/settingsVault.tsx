"use client";

import { useLocale, useT } from "@/components/i18n";
import { Modal, modalButton, modalPrimaryButton } from "@/components/sessionMenu";
import { control, Group, Row } from "@/components/settingsControls";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { api } from "@/lib/trpc";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  Key01Icon,
  LockPasswordIcon,
  UserIcon,
  ViewIcon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import { COUNTRY_CODES } from "@sirathic/server/countries";
import { Dialog } from "radix-ui";
import { type FC, type FormEvent, type ReactNode, useEffect, useState } from "react";

type Vault = Awaited<ReturnType<typeof api.vault.list.query>>;

type Adding = { kind: "none" } | { kind: "login" } | { kind: "onePassword" } | { kind: "contact" };

const inputClass =
  "bg-foreground/6 focus-visible:bg-foreground/10 h-10 w-full rounded-xl px-3 text-sm outline-none";

const blank = { site: "", username: "", password: "", code: "" };

const Field: FC<{ label: ReactNode; children: ReactNode }> = ({ label, children }) => (
  <label className="flex flex-col gap-1.5 text-sm">
    {label}
    {children}
  </label>
);

const Footer: FC<{ hint?: string; busy: boolean; ready: boolean; save: string }> = ({
  hint,
  busy,
  ready,
  save,
}) => {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
      {hint && <span className="text-muted-foreground me-auto text-xs">{hint}</span>}
      <Dialog.Close type="button" className={modalButton}>
        {t("Cancel")}
      </Dialog.Close>
      <button type="submit" disabled={busy || !ready} className={modalPrimaryButton}>
        {save}
      </button>
    </div>
  );
};

const NewLogin: FC<{ open: boolean; onClose: () => void; onSaved: () => Promise<void> }> = ({
  open,
  onClose,
  onSaved,
}) => {
  const [draft, setDraft] = useState(blank);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = useT();

  const close = () => {
    setDraft(blank);
    setVisible(false);
    setFailed(false);
    onClose();
  };

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
    close();
    await onSaved();
  };

  const field = (key: keyof typeof blank, placeholder?: string) => (
    <input
      type="text"
      required={key !== "code"}
      autoComplete="off"
      placeholder={placeholder}
      value={draft[key]}
      onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
      className={inputClass}
    />
  );

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && close()}
      title={t("New login")}
      className="max-w-130"
    >
      <form onSubmit={(event) => void save(event)} className="flex flex-col gap-4">
        <Field label={t("Website")}>{field("site", "example.com")}</Field>
        <Field label={t("Username or email")}>{field("username", "name@example.com")}</Field>
        <Field label={t("Password")}>
          <span className="bg-foreground/6 focus-within:bg-foreground/10 flex h-10 items-center rounded-xl ps-3 pe-1">
            <input
              type={visible ? "text" : "password"}
              required
              autoComplete="off"
              value={draft.password}
              onChange={(event) => setDraft({ ...draft, password: event.target.value })}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <button
              type="button"
              aria-label={visible ? t("Hide password") : t("Show password")}
              onClick={() => setVisible(!visible)}
              className="text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-lg"
            >
              <HugeiconsIcon icon={visible ? ViewOffSlashIcon : ViewIcon} className="size-4" />
            </button>
          </span>
        </Field>
        <Field
          label={
            <span>
              {t("Two-step setup key")}{" "}
              <span className="text-muted-foreground">({t("Optional")})</span>
            </span>
          }
        >
          {field("code")}
          <span className="text-muted-foreground text-xs">
            {t("Your bots enter the code for you.")}
          </span>
        </Field>
        {failed && (
          <p className="text-destructive text-sm">{t("Could not save your changes. Try again.")}</p>
        )}
        <Footer
          hint={t("Your bots can use this login to sign in for you")}
          busy={busy}
          ready={draft.site.trim() !== "" && draft.username.trim() !== "" && draft.password !== ""}
          save={t("Save login")}
        />
      </form>
    </Modal>
  );
};

const blankContact = {
  label: "",
  fullName: "",
  address: "",
  address2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  phone: "",
  email: "",
};

const NewContact: FC<{ open: boolean; onClose: () => void; onSaved: () => Promise<void> }> = ({
  open,
  onClose,
  onSaved,
}) => {
  const [draft, setDraft] = useState(blankContact);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = useT();
  const locale = useLocale();
  const regions = new Intl.DisplayNames([locale], { type: "region" });
  const countries = COUNTRY_CODES.map((code) => ({
    code,
    name: regions.of(code) ?? code,
  })).toSorted((a, b) => a.name.localeCompare(b.name, locale));
  const ready =
    draft.label.trim() !== "" &&
    Object.entries(draft).some(([key, value]) => key !== "label" && value.trim() !== "");

  const close = () => {
    setDraft(blankContact);
    setFailed(false);
    onClose();
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    const saved = await api.vault.saveContact
      .mutate({ ...draft, country: COUNTRY_CODES.find((code) => code === draft.country) })
      .then(
        () => true,
        () => false,
      );
    setBusy(false);
    if (!saved) {
      setFailed(true);
      return;
    }
    close();
    await onSaved();
  };

  const field = (key: keyof typeof blankContact, type = "text", placeholder?: string) => (
    <input
      type={type}
      autoComplete="off"
      placeholder={placeholder}
      value={draft[key]}
      onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
      className={inputClass}
    />
  );

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && close()}
      title={t("New contact info")}
      className="max-h-dvh max-w-170 overflow-y-auto"
    >
      <form onSubmit={(event) => void save(event)} className="grid grid-cols-2 gap-4">
        <Field label={t("Label")}>{field("label", "text", t("e.g. Home"))}</Field>
        <Field label={t("Full name")}>{field("fullName")}</Field>
        <div className="col-span-2">
          <Field label={t("Address")}>{field("address")}</Field>
        </div>
        <div className="col-span-2">
          <Field label={t("Address line 2")}>{field("address2")}</Field>
        </div>
        <Field label={t("City")}>{field("city")}</Field>
        <Field label={t("State or region")}>{field("region")}</Field>
        <Field label={t("ZIP or postal code")}>{field("postalCode")}</Field>
        <Field label={t("Country")}>
          <select
            value={draft.country}
            onChange={(event) => setDraft({ ...draft, country: event.target.value })}
            className={`${inputClass} ${draft.country === "" ? "text-muted-foreground" : ""}`}
          >
            <option value="">{t("Choose a country")}</option>
            {countries.map(({ code, name }) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Phone")}>{field("phone", "tel")}</Field>
        <Field label={t("Email address")}>{field("email", "email")}</Field>
        {failed && (
          <p className="text-destructive text-sm col-span-2">
            {t("Could not save your changes. Try again.")}
          </p>
        )}
        <div className="col-span-2">
          <Footer
            hint={t("Your bots can type this in for you")}
            busy={busy}
            ready={ready}
            save={t("Save contact")}
          />
        </div>
      </form>
    </Modal>
  );
};

const ConnectOnePassword: FC<{
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}> = ({ open, onClose, onSaved }) => {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = useT();

  const close = () => {
    setToken("");
    setFailed(false);
    onClose();
  };

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    const done = await api.vault.connectOnePassword.mutate({ token }).then(
      () => true,
      () => false,
    );
    setBusy(false);
    if (!done) {
      setFailed(true);
      return;
    }
    close();
    await onSaved();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && close()}
      title={t("Connect 1Password")}
      className="max-w-130"
    >
      <form onSubmit={(event) => void connect(event)} className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          {t(
            "Create a 1Password service account that can read the vault with the logins your bots may use, then paste its token here.",
          )}
        </p>
        <Field label={t("Service account token")}>
          <input
            type="password"
            required
            autoComplete="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className={inputClass}
          />
        </Field>
        {failed && (
          <p className="text-destructive text-sm">{t("1Password didn't accept that token.")}</p>
        )}
        <Footer busy={busy} ready={token !== ""} save={t("Connect 1Password")} />
      </form>
    </Modal>
  );
};

export const VaultSection: FC = () => {
  const [vault, setVault] = useState<Vault>();
  const [adding, setAdding] = useState<Adding>({ kind: "none" });
  const t = useT();

  const load = () =>
    api.vault.list.query().then(setVault, () => {
      setVault({ logins: [], onePassword: false, contacts: [] });
    });

  useEffect(() => {
    void load();
  }, []);

  const close = () => setAdding({ kind: "none" });
  const empty = vault?.logins.length === 0 && vault.contacts.length === 0 && !vault.onePassword;

  return (
    <Group>
      <div className="flex items-center gap-4 py-2">
        <p className="text-muted-foreground min-w-0 flex-1 text-sm">
          {t("Logins your bots can sign in with.")}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger className="bg-foreground text-background flex h-9 shrink-0 items-center gap-1.5 rounded-full ps-4 pe-3 text-sm font-medium">
            {t("New item")}
            <HugeiconsIcon icon={ArrowDown01Icon} className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => setAdding({ kind: "login" })}>
              <HugeiconsIcon icon={Key01Icon} className="size-4" />
              {t("Login")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setAdding({ kind: "contact" })}>
              <HugeiconsIcon icon={UserIcon} className="size-4" />
              {t("Contact info")}
            </DropdownMenuItem>
            {vault && !vault.onePassword && (
              <DropdownMenuItem onSelect={() => setAdding({ kind: "onePassword" })}>
                <HugeiconsIcon icon={LockPasswordIcon} className="size-4" />
                {t("Connect 1Password")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {empty && (
        <p className="text-muted-foreground py-6 text-center text-sm">
          {t("Nothing saved yet. Add a login with New item.")}
        </p>
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
      {vault?.contacts.map((contact) => (
        <Row key={contact.id} label={contact.label} hint={contact.fullName}>
          <button
            type="button"
            onClick={() => void api.vault.remove.mutate({ id: contact.id }).then(load)}
            className={control}
          >
            {t("Remove")}
          </button>
        </Row>
      ))}
      {vault?.onePassword && (
        <Row
          label="1Password"
          hint={t("Connected. Your bots can sign in with logins from the vault you shared.")}
        >
          <button
            type="button"
            onClick={() => void api.vault.disconnectOnePassword.mutate().then(load)}
            className={control}
          >
            {t("Disconnect")}
          </button>
        </Row>
      )}
      <p className="text-muted-foreground py-2 text-xs">
        {t(
          "Your bots only see which websites you saved. Usernames, passwords and codes go straight into the page.",
        )}
      </p>
      <NewLogin open={adding.kind === "login"} onClose={close} onSaved={load} />
      <ConnectOnePassword open={adding.kind === "onePassword"} onClose={close} onSaved={load} />
      <NewContact open={adding.kind === "contact"} onClose={close} onSaved={load} />
    </Group>
  );
};
