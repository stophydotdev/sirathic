"use client";

import { Favicon } from "@/components/favicon";
import { useT } from "@/components/i18n";
import { Modal } from "@/components/sessionMenu";
import { Group } from "@/components/settingsControls";
import {
  type ContactItem,
  ContactForm,
  dangerPill,
  type Item,
  type LoginItem,
  LoginForm,
  mainPill,
  quietPill,
  useCountries,
} from "@/components/settingsVaultForms";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Key01Icon,
  Search01Icon,
  UserIcon,
  ViewIcon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import { Dialog } from "radix-ui";
import { type FC, type ReactNode, useEffect, useState } from "react";

type Vault = Awaited<ReturnType<typeof api.vault.list.query>>;

type Shown =
  | { kind: "none" }
  | { kind: "newLogin" }
  | { kind: "newContact" }
  | { kind: "item"; id: string; title: string; contact: boolean }
  | { kind: "edit"; item: Item };

type Tab = "all" | "logins" | "contacts";

const PASSWORD_DOTS = "•".repeat(14);

const Detail: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div className="flex min-h-13 items-center gap-4 px-4 py-3 text-sm">
    <span className="text-muted-foreground w-28 shrink-0">{label}</span>
    <span className="flex min-w-0 flex-1 items-center gap-2 break-words">{children}</span>
  </div>
);

const LoginDetails: FC<{ login: LoginItem }> = ({ login }) => {
  const [visible, setVisible] = useState(false);
  const t = useT();
  return (
    <>
      <Detail label={t("Website")}>
        <span className="min-w-0 flex-1">{login.site}</span>
        <a
          href={`https://${login.site}`}
          target="_blank"
          rel="noreferrer"
          aria-label={t("Open website")}
          className="text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-4" />
        </a>
      </Detail>
      {login.username && <Detail label={t("Username")}>{login.username}</Detail>}
      <Detail label={t("Password")}>
        <span className="min-w-0 flex-1 font-mono">{visible ? login.password : PASSWORD_DOTS}</span>
        <button
          type="button"
          aria-label={visible ? t("Hide password") : t("Show password")}
          onClick={() => setVisible(!visible)}
          className="text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon icon={visible ? ViewOffSlashIcon : ViewIcon} className="size-4" />
        </button>
      </Detail>
      {login.notes && <Detail label={t("Notes")}>{login.notes}</Detail>}
    </>
  );
};

const ContactDetails: FC<{ contact: ContactItem }> = ({ contact }) => {
  const t = useT();
  const country = useCountries().find(({ code }) => code === contact.country)?.name;
  const rows = [
    [t("Full name"), contact.fullName],
    [t("Address"), contact.address],
    [t("Address line 2"), contact.address2],
    [t("City"), contact.city],
    [t("State or region"), contact.region],
    [t("ZIP or postal code"), contact.postalCode],
    [t("Country"), country],
    [t("Phone"), contact.phone],
    [t("Email address"), contact.email],
  ] as const;
  return rows.map(
    ([label, value]) =>
      value && (
        <Detail key={label} label={label}>
          {value}
        </Detail>
      ),
  );
};

const ItemView: FC<{
  shown: Extract<Shown, { kind: "item" }>;
  onClose: () => void;
  onEdit: (item: Item) => void;
  onRemoved: () => Promise<void>;
}> = ({ shown, onClose, onEdit, onRemoved }) => {
  const [item, setItem] = useState<Item>();
  const t = useT();

  useEffect(() => {
    void api.vault.open.query({ id: shown.id }).then(setItem, onClose);
  }, [shown.id]);

  const remove = async () => {
    await api.vault.remove.mutate({ id: shown.id });
    onClose();
    await onRemoved();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => !next && onClose()}
      title={shown.title}
      icon={
        shown.contact ? (
          <HugeiconsIcon icon={UserIcon} className="size-4" />
        ) : (
          <Favicon url={`https://${shown.title}`} size={16} />
        )
      }
      className="max-w-130"
    >
      <div className="border-border divide-border min-h-13 divide-y rounded-xl border">
        {item?.kind === "login" && <LoginDetails login={item} />}
        {item?.kind === "contact" && <ContactDetails contact={item} />}
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={() => void remove()} className={dangerPill}>
          {t("Remove")}
        </button>
        <button
          type="button"
          disabled={!item}
          onClick={() => item && onEdit(item)}
          className={quietPill}
        >
          {t("Edit")}
        </button>
        <Dialog.Close type="button" className={mainPill}>
          {t("Done")}
        </Dialog.Close>
      </div>
    </Modal>
  );
};

const ItemRow: FC<{ icon: ReactNode; title: string; detail?: string; onOpen: () => void }> = ({
  icon,
  title,
  detail,
  onOpen,
}) => (
  <button
    type="button"
    onClick={onOpen}
    className="border-border hover:bg-foreground/5 flex w-full items-center gap-3 rounded-2xl border p-3 text-start transition-colors"
  >
    <span className="border-border flex size-10 shrink-0 items-center justify-center rounded-xl border">
      {icon}
    </span>
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm">{title}</span>
      {detail && <span className="text-muted-foreground truncate text-sm">{detail}</span>}
    </span>
    <HugeiconsIcon
      icon={ArrowRight01Icon}
      className="text-muted-foreground size-4 shrink-0 rtl:rotate-180"
    />
  </button>
);

export const VaultSection: FC = () => {
  const [vault, setVault] = useState<Vault>();
  const [shown, setShown] = useState<Shown>({ kind: "none" });
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const t = useT();

  const load = () =>
    api.vault.list.query().then(setVault, () => {
      setVault({ logins: [], contacts: [] });
    });

  useEffect(() => {
    void load();
  }, []);

  const close = () => setShown({ kind: "none" });
  const needle = query.trim().toLowerCase();
  const matches = (...texts: (string | undefined)[]) =>
    needle === "" || texts.some((text) => text?.toLowerCase().includes(needle));
  const savedLogins = vault?.logins.length ?? 0;
  const savedContacts = vault?.contacts.length ?? 0;
  const logins =
    tab === "contacts"
      ? []
      : (vault?.logins ?? []).filter((login) => matches(login.site, login.username, login.notes));
  const contacts =
    tab === "logins"
      ? []
      : (vault?.contacts ?? []).filter((contact) => matches(contact.label, contact.fullName));
  const tabs = [
    { id: "all", label: t("All"), count: savedLogins + savedContacts },
    { id: "logins", label: t("Logins"), count: savedLogins },
    { id: "contacts", label: t("Contact info"), count: savedContacts },
  ] satisfies { id: Tab; label: string; count: number }[];
  const empty = vault !== undefined && savedLogins + savedContacts === 0;
  const unmatched = vault !== undefined && !empty && logins.length + contacts.length === 0;

  return (
    <Group>
      <div className="flex items-center gap-4 py-2">
        <p className="text-muted-foreground min-w-0 flex-1 text-sm">
          {t("Passwords and contact info your bots can fill in for you.")}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger className="bg-foreground text-background flex h-9 shrink-0 items-center gap-1.5 rounded-full ps-4 pe-3 text-sm font-medium">
            {t("New item")}
            <HugeiconsIcon icon={ArrowDown01Icon} className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => setShown({ kind: "newLogin" })}>
              <HugeiconsIcon icon={Key01Icon} className="size-4" />
              {t("Login")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setShown({ kind: "newContact" })}>
              <HugeiconsIcon icon={UserIcon} className="size-4" />
              {t("Contact info")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-wrap items-center gap-2 py-2">
        <div role="tablist" className="flex items-center gap-1">
          {tabs.map(({ id, label, count }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full px-4 text-sm",
                tab === id ? "bg-foreground/10 text-foreground" : "hover:text-foreground",
              )}
            >
              {label}
              <span className="text-muted-foreground">{count}</span>
            </button>
          ))}
        </div>
        <label className="border-border ms-auto flex h-9 w-full items-center gap-2 rounded-full border px-3 sm:w-64">
          <HugeiconsIcon icon={Search01Icon} className="text-muted-foreground size-4 shrink-0" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Search Vault")}
            aria-label={t("Search Vault")}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
      </div>
      {empty && (
        <p className="text-muted-foreground py-6 text-center text-sm">
          {t("Nothing saved yet. Add a login or contact info with New item.")}
        </p>
      )}
      {unmatched && (
        <p className="text-muted-foreground py-6 text-center text-sm">
          {t("Nothing in your vault matches that.")}
        </p>
      )}
      {logins.length + contacts.length > 0 && (
        <div className="flex flex-col gap-2 py-2">
          {logins.map((login) => (
            <ItemRow
              key={login.id}
              icon={<Favicon url={`https://${login.site}`} size={16} />}
              title={login.site}
              detail={login.username}
              onOpen={() =>
                setShown({ kind: "item", id: login.id, title: login.site, contact: false })
              }
            />
          ))}
          {contacts.map((contact) => (
            <ItemRow
              key={contact.id}
              icon={<HugeiconsIcon icon={UserIcon} className="size-4" />}
              title={contact.label}
              detail={contact.fullName}
              onOpen={() =>
                setShown({ kind: "item", id: contact.id, title: contact.label, contact: true })
              }
            />
          ))}
        </div>
      )}
      <p className="text-muted-foreground py-2 text-xs">
        {t(
          "Your bots only see which websites and labels you saved. Everything else goes straight into the page.",
        )}
      </p>
      {shown.kind === "newLogin" && <LoginForm onClose={close} onSaved={load} />}
      {shown.kind === "newContact" && <ContactForm onClose={close} onSaved={load} />}
      {shown.kind === "item" && (
        <ItemView
          shown={shown}
          onClose={close}
          onEdit={(item) => setShown({ kind: "edit", item })}
          onRemoved={load}
        />
      )}
      {shown.kind === "edit" && shown.item.kind === "login" && (
        <LoginForm editing={shown.item} onClose={close} onSaved={load} />
      )}
      {shown.kind === "edit" && shown.item.kind === "contact" && (
        <ContactForm editing={shown.item} onClose={close} onSaved={load} />
      )}
    </Group>
  );
};
