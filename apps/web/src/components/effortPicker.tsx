"use client";

import type { MessageKey } from "@/messages/en";
import {
  DEFAULT_EFFORT,
  EFFORTS,
  type Effort,
  effort as effortSchema,
} from "@sirathic/server/messages";
import { Slider } from "radix-ui";
import { type FC, useRef, useState } from "react";
import { useChatOptions } from "@/components/chatOptions";
import { useT } from "@/components/i18n";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdownMenu";
import { cn } from "@/lib/utils";

const EFFORT_NAMES = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  max: "Max",
} satisfies Record<Effort, MessageKey>;

const useEffort = () => {
  const mode = useChatOptions((s) => s.mode);
  const chosen = useChatOptions((s) => s.effort);
  const fallback = DEFAULT_EFFORT[mode];
  return { current: chosen ?? fallback, fallback };
};

export const useEffortName = () => {
  const t = useT();
  return t(EFFORT_NAMES[useEffort().current]);
};

export const EffortPicker: FC = () => {
  const t = useT();
  const { current, fallback } = useEffort();
  const setEffort = useChatOptions((s) => s.setEffort);
  const thumb = useRef<HTMLSpanElement>(null);
  const [moved, setMoved] = useState(false);
  const index = EFFORTS.indexOf(current);
  const name = t(EFFORT_NAMES[current]);
  const [before, after] = t("{level} effort", { level: "{level}" }).split("{level}");

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={(event) => event.preventDefault()}
        onFocus={() => thumb.current?.focus()}
        className="cursor-default flex-col items-stretch gap-2.5 p-1.5 focus:bg-transparent"
      >
        <p className="text-foreground text-center text-sm font-semibold">
          {before}
          <span className="text-super">{name}</span>
          {after}
        </p>
        <div className="border-input rounded-full border p-1">
          <Slider.Root
            value={[index]}
            max={EFFORTS.length - 1}
            step={1}
            onValueChange={([next]) => {
              const level = effortSchema.parse(EFFORTS[next]);
              setMoved(true);
              setEffort(level === fallback ? undefined : level);
            }}
            className={cn(
              "relative flex h-8 cursor-pointer touch-none items-center select-none",
              moved &&
                "*:transition-all *:duration-200 *:ease-out-quint motion-reduce:*:transition-none",
            )}
          >
            <span
              className="bg-super absolute inset-y-0 start-0 rounded-full"
              style={{ width: `calc((100% - 2rem) * ${index} / ${EFFORTS.length - 1} + 2rem)` }}
            />
            {EFFORTS.map((level, at) => (
              <span
                key={level}
                className={cn(
                  "absolute top-1/2 -ms-0.75 -mt-0.75 size-1.5 rounded-full",
                  at < index ? "bg-white/45" : "bg-foreground/30",
                )}
                style={{
                  insetInlineStart: `calc((100% - 2rem) * ${at} / ${EFFORTS.length - 1} + 1rem)`,
                }}
              />
            ))}
            <Slider.Thumb
              ref={thumb}
              aria-label={t("Effort")}
              aria-valuetext={name}
              className="focus-visible:ring-ring block size-8 rounded-full bg-white shadow-sm outline-none focus-visible:ring-2"
            />
          </Slider.Root>
        </div>
      </DropdownMenuItem>
    </>
  );
};
