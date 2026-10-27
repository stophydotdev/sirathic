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
import { composerControl } from "@/components/modelPicker";
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
  const chosen = useChatOptions((s) => s.effort);
  const setEffort = useChatOptions((s) => s.setEffort);
  const current = chosen ?? DEFAULT_EFFORT;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${t("Effort")}: ${t(EFFORT_NAMES[current])}`}
        className={composerControl}
      >
        <HugeiconsIcon icon={DashboardSpeed02Icon} className="text-muted-foreground size-4" />
        <span className="hidden sm:inline">{t(EFFORT_NAMES[current])}</span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          strokeWidth={2.25}
          className="text-muted-foreground size-3.5"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side={side}
        avoidCollisions={side === undefined}
        className="w-auto min-w-40 p-1"
      >
        <DropdownMenuLabel className="text-muted-foreground px-2 pt-1.5 pb-1 text-xs font-medium">
          {t("Effort")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(value) => {
            const next = effortSchema.parse(value);
            setEffort(next === DEFAULT_EFFORT ? undefined : next);
          }}
        >
          {EFFORTS.map((level) => (
            <DropdownMenuPrimitive.RadioItem
              key={level}
              value={level}
              className="text-foreground data-[state=checked]:bg-foreground/8 data-highlighted:bg-accent data-highlighted:text-accent-foreground flex min-h-8 cursor-pointer items-center rounded-sm px-2 py-1 text-base outline-none select-none sm:min-h-7 sm:text-sm"
            >
              <span className="flex min-w-0 items-center gap-1">
                <span className="min-w-0 truncate">{t(EFFORT_NAMES[level])}</span>
                {level === DEFAULT_EFFORT && (
                  <span className="border-input bg-background dark:bg-input/32 text-foreground inline-flex h-5 min-w-5 items-center justify-center rounded-sm border px-0.75 text-xs leading-none font-medium sm:h-4 sm:min-w-4">
                    {t("Default")}
                  </span>
                )}
              </span>
            </DropdownMenuPrimitive.RadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
