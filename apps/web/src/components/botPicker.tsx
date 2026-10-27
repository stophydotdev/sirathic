"use client";

import { BOT_TINTS, tintOf } from "@/components/botAvatar";
import { useT } from "@/components/i18n";
import { cn } from "@/lib/utils";
import { BOT_COLORS } from "@sirathic/server/projects";
import type { FC } from "react";

export const BotPickerPanel: FC<{
  color: string | null;
  onColor: (color: (typeof BOT_COLORS)[number]) => void;
}> = ({ color, onColor }) => {
  const t = useT();
  const active = tintOf(color);

  return (
    <div role="radiogroup" aria-label={t("Color")} className="flex justify-between">
      {BOT_COLORS.map((name) => (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={active === BOT_TINTS[name]}
          aria-label={name}
          onClick={() => onColor(name)}
          className={cn(
            "rounded-full p-0.5 ring-1 ring-transparent",
            BOT_TINTS[name].text,
            active === BOT_TINTS[name] && "ring-current",
          )}
        >
          <span className="block size-4.5 rounded-full bg-current" />
        </button>
      ))}
    </div>
  );
};
