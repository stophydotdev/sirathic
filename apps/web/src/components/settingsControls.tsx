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
import { IconChevronDown } from "@tabler/icons-react";
import { Switch } from "radix-ui";
import { type FC, type ReactNode } from "react";

export const control =
  "border-border hover:bg-muted flex h-[34px] shrink-0 items-center justify-center gap-1.5 rounded-[8px] border px-3 text-sm font-[470] transition-colors";

export const Group: FC<{ title?: string; children: ReactNode }> = ({ title, children }) => (
  <section className="mt-4 flex flex-col gap-2 first:mt-0">
    {title && <h2 className="text-muted-foreground text-[13px]">{title}</h2>}
    <div className="bg-card border-foreground/6 divide-foreground/6 divide-y rounded-[12px] border">
      {children}
    </div>
  </section>
);

export const Row: FC<{ label: string; hint?: string; children?: ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <div className="flex min-h-[58px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-sm">{label}</span>
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
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
    <div
      role="radiogroup"
      aria-label={label}
      className="border-border flex rounded-[8px] border p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-[28px] rounded-[6px] px-3 text-sm transition-colors",
            option.value === value
              ? "bg-foreground/12 text-foreground"
              : "text-muted-foreground hover:text-foreground",
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
    className="bg-foreground/15 data-[state=checked]:bg-super relative h-[22px] w-10 shrink-0 rounded-full transition-colors"
  >
    <Switch.Thumb className="bg-background block size-4 translate-x-[3px] rounded-full transition-transform data-[state=checked]:translate-x-[21px] rtl:-translate-x-[3px] rtl:data-[state=checked]:-translate-x-[21px]" />
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
        className={cn(control, "w-[220px] justify-between font-normal")}
      >
        {nameOf(value)}
        <IconChevronDown className="text-muted-foreground size-3.5" />
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
