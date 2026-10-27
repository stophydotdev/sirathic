"use client";

import { useAccount } from "@/components/account";
import { CustomPlugin } from "@/components/customPlugin";
import { Favicon } from "@/components/favicon";
import { type Translate, useT } from "@/components/i18n";
import type { PlainKey } from "@/components/locales";
import { catalogIcon, rootDomain } from "@/components/mentionIcon";
import { PluginTabs } from "@/components/pluginTabs";
import { Modal, modalButton, modalPrimaryButton } from "@/components/sessionMenu";
import { useSignIn } from "@/components/signIn";
import { SkillsTab } from "@/components/skillsTab";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { type Category, CONNECTORS } from "@sirathic/server/catalog";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Dialog } from "radix-ui";
import { type FC, type ReactNode, useEffect, useState } from "react";

type Plugin = Awaited<ReturnType<typeof api.connectors.list.query>>[number];

const CATEGORY_NAMES = {
  productivity: "Productivity",
  automation: "Automation",
  search: "Search and data",
  developer: "Developer",
  analytics: "Analytics",
  finance: "Finance",
  marketing: "Marketing",
  sales: "Sales and support",
  social: "Social media",
  design: "Design and websites",
} as const satisfies Record<Category, PlainKey>;

const describe = (t: Translate, plugin: Plugin) =>
  plugin.category === "custom" ? rootDomain(plugin.url) : t(CONNECTORS[plugin.id].description);

const byName = (a: Plugin, b: Plugin) => a.name.localeCompare(b.name);

const PluginIcon: FC<{ plugin: Plugin }> = ({ plugin }) => (
  <span className="bg-muted relative grid size-9 shrink-0 place-items-center rounded-[10px]">
    <Favicon url={`https://${rootDomain(plugin.url)}`} src={catalogIcon(plugin.url)} size={28} />
    {plugin.connected && (
      <HugeiconsIcon
        icon={Tick02Icon}
        className="bg-foreground text-background absolute -end-1 -bottom-1 size-4 rounded-full p-0.5"
      />
    )}
  </span>
);

const ToggleButton: FC<{
  plugin: Plugin;
  busy: boolean;
  onToggle: () => void;
  primary?: boolean;
}> = ({ plugin, busy, onToggle, primary }) => {
  const t = useT();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onToggle}
      className={cn(
        "h-7 shrink-0 rounded-full px-3 text-sm font-medium transition-colors disabled:opacity-50",
        plugin.connected
          ? "border-border text-muted-foreground hover:text-foreground border"
          : primary
            ? "bg-foreground text-background hover:opacity-85"
            : "bg-muted hover:bg-foreground/10",
      )}
    >
      {plugin.connected ? t("Remove") : primary ? t("Connect") : t("Add")}
    </button>
  );
};

const PluginRow: FC<{
  plugin: Plugin;
  busy: boolean;
  onOpen: () => void;
  onToggle: () => void;
}> = ({ plugin, busy, onOpen, onToggle }) => {
  const t = useT();
  return (
    <div className="flex h-16 min-w-0 items-center gap-3">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <PluginIcon plugin={plugin} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{plugin.name}</span>
          <span className="text-muted-foreground truncate text-xs">{describe(t, plugin)}</span>
        </span>
      </button>
      <ToggleButton plugin={plugin} busy={busy} onToggle={onToggle} />
    </div>
  );
};

const PluginCard: FC<{
  plugin: Plugin | undefined;
  busy: boolean;
  onClose: () => void;
  onToggle: (plugin: Plugin) => void;
}> = ({ plugin, busy, onClose, onToggle }) => {
  const t = useT();
  return (
    <Modal
      open={plugin !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={plugin?.name ?? ""}
    >
      {plugin && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <PluginIcon plugin={plugin} />
            <span className="text-muted-foreground flex-1 text-sm">
              {plugin.category === "custom"
                ? t("Your plugins")
                : t(CATEGORY_NAMES[plugin.category])}
            </span>
            <ToggleButton plugin={plugin} busy={busy} onToggle={() => onToggle(plugin)} primary />
          </div>
          <p className="text-sm">{describe(t, plugin)}</p>
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("Server URL")}</span>
            <span className="break-all">{plugin.url}</span>
          </div>
          <p className="text-muted-foreground text-xs">
            {t(
              "Plugins are made by other companies, not Sirathic. Check what a plugin can see before you connect it.",
            )}
          </p>
        </div>
      )}
    </Modal>
  );
};

const RemovePluginDialog: FC<{
  plugin: Plugin | undefined;
  onConfirm: (plugin: Plugin) => void;
  onClose: () => void;
}> = ({ plugin, onConfirm, onClose }) => {
  const t = useT();
  return (
    <Modal
      open={plugin !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("Remove plugin")}
    >
      {plugin && (
        <>
          <p className="text-muted-foreground text-sm">
            {t('Remove "{name}"? Its address and sign-in are deleted.', { name: plugin.name })}
          </p>
          <div className="flex justify-end gap-2">
            <Dialog.Close type="button" className={modalButton}>
              {t("Cancel")}
            </Dialog.Close>
            <button
              type="button"
              onClick={() => onConfirm(plugin)}
              className={cn(modalPrimaryButton, "bg-destructive text-white")}
            >
              {t("Remove")}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
};

const Section: FC<{
  title: string;
  plugins: Plugin[];
  render: (plugin: Plugin) => ReactNode;
}> = ({ title, plugins, render }) =>
  plugins.length === 0 ? null : (
    <section className="mb-6">
      <h2 className="text-muted-foreground mb-1 text-sm font-medium">{title}</h2>
      <div className="grid gap-x-10 sm:grid-cols-2">{plugins.toSorted(byName).map(render)}</div>
    </section>
  );

const PluginList: FC = () => {
  const signedIn = useAccount((s) => s.status?.signedIn);
  const ask = useSignIn((s) => s.ask);
  const [plugins, setPlugins] = useState<Plugin[]>();
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [opened, setOpened] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Plugin>();
  const t = useT();

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api.connectors.list.query().then(
      (found) => {
        if (live) setPlugins(found);
      },
      () => {
        if (live) setPlugins([]);
      },
    );
    return () => {
      live = false;
    };
  }, [signedIn, version]);

  const toggle = async (plugin: Plugin) => {
    setBusy(plugin.id);
    setFailed(false);
    try {
      if (plugin.connected) {
        await api.connectors.disconnect.mutate({ id: plugin.id });
      } else {
        const result = await api.connectors.connect.mutate({ id: plugin.id });
        if (result.status === "redirect") {
          window.location.assign(result.url);
          return;
        }
      }
      setVersion((current) => current + 1);
    } catch {
      setFailed(true);
    } finally {
      setBusy(undefined);
    }
  };

  const request = (plugin: Plugin) =>
    plugin.connected && plugin.category === "custom" ? setRemoving(plugin) : void toggle(plugin);

  const shown = (plugins ?? []).filter((plugin) =>
    plugin.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const render = (plugin: Plugin) => (
    <PluginRow
      key={plugin.id}
      plugin={plugin}
      busy={busy === plugin.id}
      onOpen={() => setOpened(plugin.id)}
      onToggle={() => request(plugin)}
    />
  );
  const categories = Object.entries(CATEGORY_NAMES)
    .map(([category, name]) => ({ category, name: t(name) }))
    .toSorted((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <PluginTabs tab="plugins" />
        <label className="bg-muted/60 order-last flex h-9 w-full items-center gap-2 rounded-full px-3 sm:order-none sm:w-64">
          <HugeiconsIcon icon={Search01Icon} className="text-muted-foreground size-4 shrink-0" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Search plugins")}
            aria-label={t("Search plugins")}
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => (signedIn ? setAdding(true) : ask())}
          className="bg-foreground text-background h-9 rounded-full px-4 text-sm font-medium transition hover:opacity-85"
        >
          {t("Custom plugin")}
        </button>
      </div>
      {signedIn === false && (
        <button type="button" onClick={() => ask()} className="text-sm underline">
          {t("Sign in to add plugins.")}
        </button>
      )}
      {failed && (
        <p className="text-destructive mb-4 text-sm">
          {t("That plugin could not connect. Check the address and try again.")}
        </p>
      )}
      {plugins && shown.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("No plugins match your search.")}</p>
      )}
      <Section
        title={t("Popular")}
        plugins={shown.filter((plugin) => plugin.popular)}
        render={render}
      />
      <Section
        title={t("Your plugins")}
        plugins={shown.filter((plugin) => plugin.category === "custom")}
        render={render}
      />
      {categories.map(({ category, name }) => (
        <Section
          key={category}
          title={name}
          plugins={shown.filter((plugin) => !plugin.popular && plugin.category === category)}
          render={render}
        />
      ))}
      <PluginCard
        plugin={plugins?.find((plugin) => plugin.id === opened)}
        busy={busy === opened}
        onClose={() => setOpened(undefined)}
        onToggle={request}
      />
      <RemovePluginDialog
        plugin={removing}
        onConfirm={(plugin) => {
          setRemoving(undefined);
          void toggle(plugin);
        }}
        onClose={() => setRemoving(undefined)}
      />
      <CustomPlugin
        open={adding}
        onOpenChange={setAdding}
        onAdded={() => setVersion((current) => current + 1)}
      />
    </>
  );
};

export const Plugins: FC<{ tab: "plugins" | "skills" }> = ({ tab }) => (
  <div className="h-full overflow-y-auto">
    <div className="mx-auto w-full max-w-5xl px-6 pt-16 pb-16 lg:pt-10">
      {tab === "skills" ? <SkillsTab /> : <PluginList />}
    </div>
  </div>
);
