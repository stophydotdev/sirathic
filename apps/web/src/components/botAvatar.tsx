import { BOT_ICON_FILES } from "@/components/botIconFiles";
import { cn } from "@/lib/utils";
import type { BOT_COLORS } from "@sirathic/server/projects";
import type { CSSProperties, FC } from "react";

type BotColor = (typeof BOT_COLORS)[number];

export const BOT_TINTS = {
  white: { text: "text-zinc-100", tint: "bg-zinc-100/15" },
  brown: { text: "text-[#b08968]", tint: "bg-[#b08968]/20" },
  red: { text: "text-red-400", tint: "bg-red-400/15" },
  orange: { text: "text-orange-400", tint: "bg-orange-400/15" },
  yellow: { text: "text-yellow-400", tint: "bg-yellow-400/15" },
  green: { text: "text-green-400", tint: "bg-green-400/15" },
  teal: { text: "text-teal-400", tint: "bg-teal-400/15" },
  blue: { text: "text-blue-400", tint: "bg-blue-400/15" },
  violet: { text: "text-violet-400", tint: "bg-violet-400/15" },
  pink: { text: "text-pink-400", tint: "bg-pink-400/15" },
  gray: { text: "text-zinc-400", tint: "bg-zinc-400/15" },
} as const satisfies Record<BotColor, { text: string; tint: string }>;

export const tintOf = (color: string | null) =>
  Object.entries(BOT_TINTS).find(([name]) => name === color)?.[1] ?? BOT_TINTS.teal;

const filesOf = (icon: string | null) =>
  Object.entries(BOT_ICON_FILES).find(([name]) => name === icon)?.[1] ?? BOT_ICON_FILES.star;

export const BotIconMark: FC<{ icon: string | null; className?: string }> = ({
  icon,
  className,
}) => {
  const mask = `url(${filesOf(icon).src})`;
  return (
    <span
      aria-hidden
      className={cn("bg-current", className)}
      style={
        {
          maskImage: mask,
          WebkitMaskImage: mask,
          maskSize: "contain",
          maskRepeat: "no-repeat",
          maskPosition: "center",
        } satisfies CSSProperties
      }
    />
  );
};

export const BotAvatar: FC<{
  color: string | null;
  icon: string | null;
  className?: string;
}> = ({ color, icon, className }) => {
  const { text, tint } = tintOf(color);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full",
        text,
        tint,
        className,
      )}
    >
      <BotIconMark icon={icon} className="size-[58%]" />
    </span>
  );
};
