"use client";

import { BOT_TINTS, BotIconMark, tintOf } from "@/components/botAvatar";
import { BOT_ICON_FILES } from "@/components/botIconFiles";
import { useT } from "@/components/i18n";
import { cn } from "@/lib/utils";
import { BOT_COLORS, BOT_ICONS } from "@sirathic/server/projects";
import type { FC } from "react";

const CREDIT_URL = "https://www.flaticon.com/free-icons/muslim";

const authors = [
  ...new Set(Object.values(BOT_ICON_FILES).flatMap(({ author }) => (author ? [author] : []))),
].join(", ");

type PickerProps = {
  color: string | null;
  icon: string | null;
  onColor: (color: (typeof BOT_COLORS)[number]) => void;
  onIcon: (icon: (typeof BOT_ICONS)[number]) => void;
};

export const BotPickerPanel: FC<PickerProps & { className?: string }> = ({
  color,
  icon,
  onColor,
  onIcon,
  className,
}) => {
  const t = useT();
  const active = tintOf(color);
  const activeIcon = icon ?? "star";

  return (
    <div className={cn("@container flex flex-col gap-3", className)}>
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
      <div className="grid grid-cols-5 gap-1.5 @xs:grid-cols-10">
        {BOT_ICONS.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={activeIcon === name}
            aria-label={name}
            onClick={() => onIcon(name)}
            className={cn(
              "text-muted-foreground bg-foreground/5 hover:bg-muted flex aspect-square items-center justify-center rounded-lg",
              activeIcon === name && cn("bg-foreground/15", active.text),
            )}
          >
            <BotIconMark icon={name} className="size-3/5" />
          </button>
        ))}
      </div>
      <a
        href={CREDIT_URL}
        target="_blank"
        rel="noreferrer"
        title={authors}
        className="text-muted-foreground hover:text-foreground text-xs"
      >
        {t("Icons from Flaticon")}
      </a>
    </div>
  );
};
