"use client";

import { BOT_TINTS, tintOf } from "@/components/botAvatar";
import { useT } from "@/components/i18n";
import { BODIES, bodyOf, pathOf } from "@/lib/blob/shape";
import { cn } from "@/lib/utils";
import { BOT_COLORS, BOT_BODIES } from "@sirathic/server/projects";
import type { FC } from "react";

export const BotPickerPanel: FC<{
  color: string | null;
  body: string | null;
  seed: string;
  onColor: (color: (typeof BOT_COLORS)[number]) => void;
  onBody: (body: (typeof BOT_BODIES)[number]) => void;
}> = ({ color, body, seed, onColor, onBody }) => {
  const t = useT();
  const active = tintOf(color);
  const current = bodyOf(body, seed);

  return (
    <div className="flex flex-col gap-3">
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
      <div role="radiogroup" aria-label={t("Edit bot avatar")} className="grid grid-cols-8 gap-1.5">
        {BOT_BODIES.map((name) => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={BODIES[name] === current}
            aria-label={name}
            onClick={() => onBody(name)}
            className={cn(
              "hover:bg-muted flex aspect-square items-center justify-center rounded-lg",
              active.text,
              BODIES[name] === current && "bg-foreground/15",
            )}
          >
            <svg aria-hidden viewBox="-115 -115 230 230" className="size-3/5">
              <path
                d={pathOf({ radii: BODIES[name], rot: 0, cx: 0, cy: 0 }, 100)}
                fill="currentColor"
              />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
};
