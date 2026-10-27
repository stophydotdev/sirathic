"use client";

import { useT } from "@/components/i18n";
import { cn } from "@/lib/utils";
import { currentToolName } from "@sirathic/server/messages";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { BrainIcon, SparklesIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import type { FC } from "react";
import { z } from "zod";

const EVENT_TOOLS = new Set(["update_memory", "update_skill"]);

export const isBotEvent = (name: string) => EVENT_TOOLS.has(currentToolName(name));

const skillSaved = z.object({ action: z.enum(["write", "delete"]), name: z.string() });

const memorySaved = z.string().regex(/^(Saved|Forgot)/u);

export const EventLine: FC<{
  icon: IconSvgElement;
  label: string;
  name?: string;
  href?: string;
  subtle?: boolean;
}> = ({ icon, label, name, href, subtle }) => {
  const mark = <HugeiconsIcon icon={icon} className="size-3.5 shrink-0" />;
  return (
    <p
      className={cn(
        "text-muted-foreground my-3 flex w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-center text-xs",
        subtle && "opacity-70",
      )}
    >
      {name === undefined && mark}
      {label}
      {name !== undefined && (
        <>
          <span aria-hidden>·</span>
          {mark}
          {href ? (
            <Link href={href} className="text-super max-w-48 truncate hover:underline">
              {name}
            </Link>
          ) : (
            <span className="text-foreground max-w-48 truncate">{name}</span>
          )}
        </>
      )}
    </p>
  );
};

export const BotEvent: FC<{ tool: string; result: unknown }> = ({ tool, result }) => {
  const t = useT();
  const name = currentToolName(tool);
  const skill = name === "update_skill" ? skillSaved.safeParse(result).data : undefined;
  if (skill) {
    return (
      <EventLine
        icon={SparklesIcon}
        label={skill.action === "write" ? t("Saved skill") : t("Deleted skill")}
        name={skill.name}
        href={skill.action === "write" ? "/plugins?tab=skills" : undefined}
      />
    );
  }
  if (name === "update_memory" && memorySaved.safeParse(result).success) {
    return <EventLine icon={BrainIcon} label={t("Memory updated")} subtle />;
  }
  return null;
};
