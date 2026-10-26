"use client";

import { useLocale, useT } from "@/components/i18n";
import { type Project, useProjects } from "@/components/projects";
import { IconX } from "@tabler/icons-react";
import { type FC, useEffect } from "react";

export const BotProfile: FC<{ bot: Project }> = ({ bot }) => {
  const change = useProjects((s) => s.change);
  const refresh = useProjects((s) => s.refresh);
  const locale = useLocale();
  const t = useT();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (bot.profile.length === 0) return null;

  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-sm font-medium">{t("What this bot knows about you")}</h3>
      <p className="text-muted-foreground mb-1 text-[13px]">
        {t("What this bot has learned about you. Remove anything that is wrong.")}
      </p>
      {bot.profile.map((entry) => (
        <div key={entry.text} className="-mx-2 flex items-start gap-2 rounded-[10px] px-2 py-1.5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm break-words">{entry.text}</span>
            <span className="text-muted-foreground text-xs">
              {entry.source === "said" ? t("You said") : t("Guessed")}
              {" · "}
              {new Date(entry.at).toLocaleDateString(locale)}
            </span>
          </div>
          <button
            type="button"
            aria-label={t("Remove")}
            onClick={() =>
              void change(bot.id, {
                profile: bot.profile.filter((kept) => kept.text !== entry.text),
              })
            }
            className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded-full p-1"
          >
            <IconX className="size-4" />
          </button>
        </div>
      ))}
    </section>
  );
};
