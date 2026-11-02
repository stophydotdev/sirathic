"use client";

import { useLocale, useT } from "@/components/i18n";
import { Modal } from "@/components/sessionMenu";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { TRPCClientError } from "@trpc/client";
import { Key01Icon, UserIcon, ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons";
import { COUNTRY_CODES } from "@sirathic/server/countries";
import { Dialog } from "radix-ui";
import { type FC, type FormEvent, type ReactNode, useState } from "react";

export type Item = Awaited<ReturnType<typeof api.vault.open.query>>;
export type LoginItem = Extract<Item, { kind: "login" }>;
export type ContactItem = Extract<Item, { kind: "contact" }>;

const inputClass =
  "border-border focus-visible:border-foreground/30 h-11 w-full rounded-xl border bg-transparent px-3 text-sm outline-none";
const pill =
  "flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors disabled:opacity-50";
export const quietPill = cn(pill, "bg-foreground/10 hover:bg-foreground/15");
export const mainPill = cn(pill, "bg-foreground text-background hover:opacity-85");
export const dangerPill = cn(
  pill,
  "border-destructive/40 text-destructive hover:bg-destructive/10 border",
);

const blank = { site: "", username: "", password: "", notes: "" };

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

const Field: FC<{ label: ReactNode; children: ReactNode }> = ({ label, children }) => (
  <label className="flex flex-col gap-1.5 text-sm">
    {label}
    {children}
  </label>
);

const Optional: FC<{ label: string }> = ({ label }) => {
  const t = useT();
  return (
    <span>
      {label} <span className="text-muted-foreground">({t("Optional")})</span>
    </span>
  );
};

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
      <Dialog.Close type="button" className={quietPill}>
        {t("Cancel")}
      </Dialog.Close>
      <button type="submit" disabled={busy || !ready} className={mainPill}>
        {save}
      </button>
    </div>
  );
};

const useSave = (onClose: () => void, onSaved: () => Promise<void>) => {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<"taken" | "error">();
  const save = async (event: FormEvent, request: () => Promise<void>) => {
    event.preventDefault();
    setBusy(true);
    setFailed(undefined);
    const problem = await request().then(
      () => undefined,
      (error: Error) =>
        error instanceof TRPCClientError && error.data?.code === "CONFLICT" ? "taken" : "error",
    );
    setBusy(false);
    if (problem) {
      setFailed(problem);
      return;
    }
    onClose();
    await onSaved();
  };
  return { busy, failed, save };
};

export const LoginForm: FC<{
  editing?: LoginItem;
  onClose: () => void;
  onSaved: () => Promise<void>;
}> = ({ editing, onClose, onSaved }) => {
  const [draft, setDraft] = useState(
    editing
      ? {
          site: editing.site,
          username: editing.username ?? "",
          password: editing.password,
          notes: editing.notes ?? "",
        }
      : blank,
  );
  const [visible, setVisible] = useState(false);
  const { busy, failed, save } = useSave(onClose, onSaved);
  const t = useT();

  const login = () => ({
    site: draft.site,
    password: draft.password,
    username: draft.username.trim() || undefined,
    notes: draft.notes.trim() || undefined,
  });

  const field = (key: keyof typeof blank, placeholder?: string) => (
    <input
      type="text"
      required={key === "site"}
      autoComplete="off"
      placeholder={placeholder}
      value={draft[key]}
      onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
      className={inputClass}
    />
  );

  return (
    <Modal
      open
      onOpenChange={(next) => !next && onClose()}
      title={editing ? t("Edit login") : t("New login")}
      icon={<HugeiconsIcon icon={Key01Icon} className="size-4" />}
      className="max-w-130"
    >
      <form
        onSubmit={(event) =>
          void save(event, async () => {
            await (editing
              ? api.vault.update.mutate({ id: editing.id, login: login() })
              : api.vault.save.mutate(login()));
          })
        }
        className="flex flex-col gap-4"
      >
        <Field label={t("Website")}>{field("site", "example.com")}</Field>
        <Field label={<Optional label={t("Username or email")} />}>
          {field("username", "name@example.com")}
        </Field>
        <Field label={t("Password")}>
          <span className="border-border focus-within:border-foreground/30 flex h-11 items-center rounded-xl border ps-3 pe-1">
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
              className="text-muted-foreground hover:text-foreground flex size-9 items-center justify-center rounded-lg"
            >
              <HugeiconsIcon icon={visible ? ViewOffSlashIcon : ViewIcon} className="size-4" />
            </button>
          </span>
        </Field>
        <Field label={<Optional label={t("Notes")} />}>
          <textarea
            rows={3}
            autoComplete="off"
            value={draft.notes}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            className="border-border focus-visible:border-foreground/30 w-full resize-none rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none"
          />
        </Field>
        {failed && (
          <p className="text-destructive text-sm">
            {failed === "taken"
              ? t("You already saved a login for this site. Open it to change it.")
              : t("Could not save your changes. Try again.")}
          </p>
        )}
        <Footer
          hint={t("Your bots can use this login to sign in for you")}
          busy={busy}
          ready={draft.site.trim() !== "" && draft.password !== ""}
          save={t("Save login")}
        />
      </form>
    </Modal>
  );
};

export const useCountries = () => {
  const locale = useLocale();
  const regions = new Intl.DisplayNames([locale], { type: "region" });
  return COUNTRY_CODES.map((code) => ({
    code,
    name: regions.of(code) ?? code,
  })).toSorted((a, b) => a.name.localeCompare(b.name, locale));
};

export const ContactForm: FC<{
  editing?: ContactItem;
  onClose: () => void;
  onSaved: () => Promise<void>;
}> = ({ editing, onClose, onSaved }) => {
  const [draft, setDraft] = useState(() => {
    if (!editing) return blankContact;
    const { kind: _kind, id: _id, ...saved } = editing;
    return { ...blankContact, ...saved };
  });
  const { busy, failed, save } = useSave(onClose, onSaved);
  const t = useT();
  const countries = useCountries();
  const ready =
    draft.label.trim() !== "" &&
    Object.entries(draft).some(([key, value]) => key !== "label" && value.trim() !== "");

  const contact = () => ({
    ...draft,
    country: COUNTRY_CODES.find((code) => code === draft.country),
  });

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
      open
      onOpenChange={(next) => !next && onClose()}
      title={editing ? t("Edit contact info") : t("New contact info")}
      icon={<HugeiconsIcon icon={UserIcon} className="size-4" />}
      className="max-h-dvh max-w-170 overflow-y-auto"
    >
      <form
        onSubmit={(event) =>
          void save(event, async () => {
            await (editing
              ? api.vault.updateContact.mutate({ id: editing.id, contact: contact() })
              : api.vault.saveContact.mutate(contact()));
          })
        }
        className="grid grid-cols-2 gap-4"
      >
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
            className={cn(inputClass, draft.country === "" && "text-muted-foreground")}
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
          <p className="text-destructive col-span-2 text-sm">
            {failed === "taken"
              ? t("You already saved a contact with this label. Open it to change it.")
              : t("Could not save your changes. Try again.")}
          </p>
        )}
        <div className="col-span-2">
          <Footer busy={busy} ready={ready} save={t("Save contact")} />
        </div>
      </form>
    </Modal>
  );
};
