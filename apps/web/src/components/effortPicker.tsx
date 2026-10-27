"use client";

import type { MessageKey } from "@/messages/en";
import { ArrowDown01Icon, DashboardSpeed02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DEFAULT_EFFORT,
  EFFORTS,
  type Effort,
  effort as effortSchema,
} from "@sirathic/server/messages";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import type { FC } from "react";
import { useChatOptions } from "@/components/chatOptions";
import { useT } from "@/components/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";

const EFFORT_NAMES = {
  low: "Low",
  medium: "Medium",
  high: "High",
} satisfies Record<Effort, MessageKey>;

export const EffortPicker: FC<{ side?: "top" | "bottom" }> = ({ side }) => {
  const t = useT();
  const mode = useChatOptions((s) => s.mode);
  const chosen = useChatOptions((s) => s.effort);
  const setEffort = useChatOptions((s) => s.setEffort);
  const fallback = DEFAULT_EFFORT[mode];
  const current = chosen ?? fallback;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${t("Effort")}: ${t(EFFORT_NAMES[current])}`}
        className="text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-[470] transition-colors sm:px-3"
      >
        <HugeiconsIcon icon={DashboardSpeed02Icon} className="size-4 shrink-0" />
        <span className="hidden sm:inline">{t(EFFORT_NAMES[current])}</span>
        <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side={side}
        avoidCollisions={side === undefined}
        className="ring-foreground/7 w-48 rounded-[12px] p-1"
      >
        <DropdownMenuLabel className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
          {t("Effort")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(value) => {
            const next = effortSchema.parse(value);
            setEffort(next === fallback ? undefined : next);
          }}
        >
          {EFFORTS.map((level) => (
            <DropdownMenuPrimitive.RadioItem
              key={level}
              value={level}
              className="focus:bg-accent data-[state=checked]:bg-foreground/8 flex h-8 cursor-pointer items-center gap-2 rounded-[8px] px-2 text-sm font-[360] outline-hidden select-none"
            >
              <span className="flex-1">{t(EFFORT_NAMES[level])}</span>
              {level === fallback && (
                <span className="border-border text-muted-foreground flex h-4 items-center rounded-sm border px-1 text-xs leading-none">
                  {t("Default")}
                </span>
              )}
            </DropdownMenuPrimitive.RadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
