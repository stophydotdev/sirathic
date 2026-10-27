"use client";

import { useT } from "@/components/i18n";
import { type PlainKey } from "@/components/locales";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { Switch } from "radix-ui";
import { type FC, type ReactNode } from "react";

export const control =
  "border-foreground/10 hover:bg-muted flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[12px] border px-2.5 text-sm font-medium transition-colors";

export const Group: FC<{ title?: string; children: ReactNode }> = ({ title, children }) => (
  <section className="border-foreground/6 flex flex-col border-t py-3 first:border-t-0 first:pt-0">
    {title && <h2 className="text-muted-foreground pt-1 text-[13px]">{title}</h2>}
    {children}
  </section>
);

export const Row: FC<{ label: string; hint?: string; children?: ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <div className="flex min-h-[52px] flex-wrap items-center gap-x-4 gap-y-2 py-3">
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-sm">{label}</span>
      {hint && <span className="text-muted-foreground max-w-[28rem] text-[13px]">{hint}</span>}
    </div>
    {children}
  </div>
);

export function Segmented<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: readonly { value: Value; label: PlainKey }[];
  onChange: (next: Value) => void;
}) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-8 rounded-full border px-3 text-sm transition-colors",
            option.value === value
              ? "border-foreground/40 bg-foreground/12 text-foreground"
              : "border-foreground/10 text-muted-foreground hover:text-foreground",
          )}
        >
          {t(option.label)}
        </button>
      ))}
    </div>
  );
}

export const Toggle: FC<{
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <Switch.Root
    aria-label={label}
    checked={checked}
    onCheckedChange={onChange}
    className="bg-foreground/15 data-[state=checked]:bg-super relative h-[18px] w-8 shrink-0 rounded-full transition-colors"
  >
    <Switch.Thumb className="block size-3.5 translate-x-[2px] rounded-full bg-white transition-transform data-[state=checked]:translate-x-[16px] rtl:-translate-x-[2px] rtl:data-[state=checked]:-translate-x-[16px]" />
  </Switch.Root>
);

export function Choice<Value extends string>({
  label,
  value,
  options,
  nameOf,
  onChange,
}: {
  label: string;
  value: Value;
  options: readonly Value[];
  nameOf: (value: Value) => string;
  onChange: (next: Value) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="text-muted-foreground hover:text-foreground flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-medium transition-colors"
      >
        {nameOf(value)}
        <HugeiconsIcon icon={ArrowDown01Icon} className="text-muted-foreground size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px]">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            const picked = options.find((option) => option === next);
            if (picked) onChange(picked);
          }}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {nameOf(option)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
