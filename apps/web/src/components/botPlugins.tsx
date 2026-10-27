"use client";

import { useT } from "@/components/i18n";
import { MentionIcon } from "@/components/mentionIcon";
import { useOwnLists } from "@/components/ownLists";
import { useProjects } from "@/components/projects";
import { cn } from "@/lib/utils";
import { type FC, useEffect } from "react";

export const BotPlugins: FC<{ id: string; allowed: string[] | null }> = ({ id, allowed }) => {
  const plugins = useOwnLists((s) => s.plugins).filter((plugin) => plugin.connected);
  const change = useProjects((s) => s.change);
  const t = useT();

  useEffect(() => {
    void useOwnLists.getState().load();
  }, []);

  if (plugins.length === 0) return null;
  const enabled = allowed ?? plugins.map((plugin) => plugin.id);
  const toggle = (pluginId: string) =>
    void change(id, {
      plugins: enabled.includes(pluginId)
        ? enabled.filter((kept) => kept !== pluginId)
        : [...enabled, pluginId],
    });

  return (
    <section className="bg-card flex flex-col gap-1 rounded-xl p-4">
      <h3 className="text-sm font-medium">{t("Plugins")}</h3>
      <p className="text-muted-foreground mb-1 text-[13px]">{t("Plugins this bot can use.")}</p>
      {plugins.map((plugin) => {
        const on = enabled.includes(plugin.id);
        return (
          <button
            key={plugin.id}
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => toggle(plugin.id)}
            className="hover:bg-muted -mx-2 flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-start text-sm"
          >
            <MentionIcon target={{ name: plugin.name, url: plugin.url }} />
            <span className="min-w-0 flex-1 truncate">{plugin.name}</span>
            <span
              className={cn(
                "flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
                on ? "bg-foreground justify-end" : "bg-foreground/15 justify-start",
              )}
            >
              <span className="bg-background size-4 rounded-full" />
            </span>
          </button>
        );
      })}
    </section>
  );
};
