"use client";

import { useT } from "@/components/i18n";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { type FC } from "react";
import { z } from "zod";

const installed = z.discriminatedUnion("status", [
  z.object({ status: z.literal("connected"), name: z.string() }),
  z.object({ status: z.literal("redirect"), name: z.string(), url: z.url() }),
]);

export const PluginCard: FC<{ result: unknown }> = ({ result }) => {
  const t = useT();
  const plugin = installed.safeParse(result).data;
  if (!plugin) return null;
  return (
    <div className="border-foreground/10 bg-background my-3 flex w-full max-w-lg items-center justify-between gap-3 rounded-3xl border px-4 py-3 print:hidden">
      <span className="truncate text-sm font-medium">{plugin.name}</span>
      {plugin.status === "connected" ? (
        <span className="text-muted-foreground flex items-center gap-1 text-sm">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4.5" />
          {t("Connected")}
        </span>
      ) : (
        <a
          href={plugin.url}
          target="_blank"
          rel="noreferrer"
          className="bg-foreground text-background flex h-8 shrink-0 items-center rounded-full px-3 text-sm font-medium"
        >
          {t("Connect")}
        </a>
      )}
    </div>
  );
};
