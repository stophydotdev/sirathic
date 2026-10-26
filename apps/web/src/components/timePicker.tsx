"use client";

import {
  clockParts,
  clockText,
  clockText24,
  dayPeriods,
  hour12Of,
  hour24Of,
  uses12Hours,
} from "@/components/automationText";
import { useLocale, useT } from "@/components/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { type FC, useState } from "react";

const MINUTE_STEP = 5;

const pad = (value: number) => String(value).padStart(2, "0");

const wrap = (value: number, min: number, max: number) => {
  const size = max - min + 1;
  return ((((value - min) % size) + size) % size) + min;
};

const cellClass = (active: boolean) =>
  cn(
    "grid h-8 w-full shrink-0 place-items-center rounded-lg text-sm tabular-nums transition-colors",
    active ? "bg-foreground text-background font-medium" : "hover:bg-foreground/10",
  );

const NumberField: FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onEnter: () => void;
}> = ({ label, value, min, max, onChange, onEnter }) => {
  const [typed, setTyped] = useState<string>();
  return (
    <input
      inputMode="numeric"
      aria-label={label}
      value={typed ?? pad(value)}
      onFocus={(event) => event.target.select()}
      onBlur={() => setTyped(undefined)}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/gu, "").slice(-2);
        const fitted = Number(digits) > max ? digits.slice(-1) : digits;
        setTyped(fitted);
        if (fitted !== "" && Number(fitted) >= min) onChange(Number(fitted));
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onEnter();
          return;
        }
        const step = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
        if (step === 0) return;
        event.preventDefault();
        setTyped(undefined);
        onChange(wrap(value + step, min, max));
      }}
      className="bg-muted focus-visible:ring-foreground/30 h-9 w-11 rounded-lg text-center text-sm tabular-nums outline-none focus-visible:ring-2"
    />
  );
};

const Column: FC<{
  label: string;
  choices: { value: number; text: string }[];
  selected: number;
  onPick: (value: number) => void;
}> = ({ label, choices, selected, onPick }) => (
  <div
    role="listbox"
    aria-label={label}
    ref={(node) => {
      const active = node?.querySelector<HTMLElement>("[aria-selected='true']");
      if (node && active) {
        node.scrollTop = active.offsetTop - (node.clientHeight - active.clientHeight) / 2;
      }
    }}
    className="relative flex max-h-40 flex-col gap-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  >
    {choices.map((choice) => (
      <button
        key={choice.value}
        type="button"
        role="option"
        tabIndex={-1}
        aria-selected={choice.value === selected}
        onClick={() => onPick(choice.value)}
        className={cellClass(choice.value === selected)}
      >
        {choice.text}
      </button>
    ))}
  </div>
);

const range = (from: number, to: number, step = 1) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, index) => from + index * step);

export const TimePicker: FC<{
  value: string;
  label: string;
  onChange: (time: string) => void;
  className?: string;
}> = ({ value, label, onChange, className }) => {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const { hour, minute } = clockParts(value);
  const twelve = uses12Hours(locale);
  const pm = hour >= 12;
  const periods = dayPeriods(locale);
  const setHour = (next: number) => onChange(clockText24(next, minute));
  const setMinute = (next: number) => onChange(clockText24(hour, next));
  const hours = twelve ? range(1, 12) : range(0, 23);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label={label} className={className}>
        {clockText(locale, value)}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        dir="ltr"
        collisionPadding={8}
        onOpenAutoFocus={(event) => {
          if (matchMedia("(pointer: coarse)").matches) event.preventDefault();
        }}
        className="bg-fill z-[70] w-52 gap-2 p-2"
      >
        <div className="flex items-center gap-1.5">
          <NumberField
            label={t("Hour")}
            value={twelve ? hour12Of(hour) : hour}
            min={twelve ? 1 : 0}
            max={twelve ? 12 : 23}
            onChange={(next) => setHour(twelve ? hour24Of(next, pm) : next)}
            onEnter={() => setOpen(false)}
          />
          <span className="text-muted-foreground">:</span>
          <NumberField
            label={t("Minute")}
            value={minute}
            min={0}
            max={59}
            onChange={setMinute}
            onEnter={() => setOpen(false)}
          />
          {twelve && (
            <div className="bg-muted ms-auto flex rounded-lg p-0.5">
              {[
                { text: periods.am, isPm: false },
                { text: periods.pm, isPm: true },
              ].map(({ text, isPm }) => (
                <button
                  key={text}
                  type="button"
                  aria-pressed={pm === isPm}
                  onClick={() => setHour(hour24Of(hour12Of(hour), isPm))}
                  className={cn(
                    "h-8 rounded-md px-2 text-xs font-medium transition-colors",
                    pm === isPm
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {text}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Column
            label={t("Hour")}
            choices={hours.map((choice) => ({ value: choice, text: pad(choice) }))}
            selected={twelve ? hour12Of(hour) : hour}
            onPick={(next) => setHour(twelve ? hour24Of(next, pm) : next)}
          />
          <Column
            label={t("Minute")}
            choices={range(0, 59, MINUTE_STEP).map((choice) => ({
              value: choice,
              text: pad(choice),
            }))}
            selected={minute}
            onPick={setMinute}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};
