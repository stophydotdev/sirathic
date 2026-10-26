"use client";

import { dayOf, monthNames, type Schedule, weekdayNames } from "@/components/automationText";
import { type Draft, isoOf, todayIso } from "@/components/automationDraft";
import { type Translate, useLocale, useT } from "@/components/i18n";
import { isRtl } from "@/components/locales";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { cn } from "@/lib/utils";
import { IconCalendar, IconChevronDown, IconPlus, IconX } from "@tabler/icons-react";
import { type FC, Fragment, type ReactNode, useState } from "react";

const KINDS = [
  "once",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
] as const satisfies readonly Schedule["kind"][];

const LEAP_YEAR = 2024;

const daysIn = (month: number) => new Date(LEAP_YEAR, month, 0).getDate();

const dayChoices = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ value: index + 1, label: String(index + 1) }));

const pill =
  "bg-fill hover:bg-foreground/10 flex h-7 shrink-0 items-center gap-1 rounded-[8px] px-2.5 text-sm font-medium outline-none transition-colors";

const menu = "z-[70] w-auto min-w-36 max-h-64";

const nativePill = cn(pill, "scheme-light dark:scheme-dark");

const kindTitles = (t: Translate) =>
  ({
    once: t("Once"),
    hourly: t("Hourly"),
    daily: t("Daily"),
    weekly: t("Weekly"),
    monthly: t("Monthly"),
    yearly: t("Yearly"),
  }) satisfies Record<Schedule["kind"], string>;

const KindItems: FC<{ kind: Draft["kind"]; onPick: (kind: Schedule["kind"]) => void }> = ({
  kind,
  onPick,
}) => {
  const t = useT();
  const titles = kindTitles(t);
  const hints = {
    once: t("On a date and time"),
    hourly: t("Every hour within hours"),
    daily: t("Every day at a time"),
    weekly: t("On chosen days"),
    monthly: t("On a chosen day"),
    yearly: t("Every year on a date"),
  } satisfies Record<Schedule["kind"], string>;
  return (
    <DropdownMenuRadioGroup
      value={kind ?? ""}
      onValueChange={(value) => {
        const picked = KINDS.find((known) => known === value);
        if (picked) onPick(picked);
      }}
    >
      {KINDS.map((known) => (
        <DropdownMenuRadioItem key={known} value={known} className="items-baseline py-1.5">
          <span className="w-16 shrink-0 font-medium">{titles[known]}</span>
          <span className="text-muted-foreground text-xs">{hints[known]}</span>
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
};

const ChoicePill: FC<{
  label: string;
  value: number;
  choices: { value: number; label: string }[];
  onPick: (value: number) => void;
}> = ({ label, value, choices, onPick }) => (
  <DropdownMenu>
    <DropdownMenuTrigger className={pill}>
      {label}
      <IconChevronDown className="text-muted-foreground size-3.5" />
    </DropdownMenuTrigger>
    <DropdownMenuContent className={menu}>
      <DropdownMenuRadioGroup value={String(value)} onValueChange={(next) => onPick(Number(next))}>
        {choices.map((choice) => (
          <DropdownMenuRadioItem key={choice.value} value={String(choice.value)}>
            {choice.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);

const TimePill: FC<{ value: string; label: string; onChange: (time: string) => void }> = ({
  value,
  label,
  onChange,
}) => (
  <input
    type="time"
    aria-label={label}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className={nativePill}
  />
);

const DatePill: FC<{ value: string; onChange: (date: string) => void }> = ({ value, onChange }) => {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const selected = dayOf(value);
  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label={t("Date")} className={pill}>
        <IconCalendar className="text-muted-foreground size-3.5" />
        {formatter.format(selected)}
      </PopoverTrigger>
      <PopoverContent className="bg-fill z-[70] w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          classNames={{ disabled: "[&_button]:opacity-100!" }}
          selected={selected}
          defaultMonth={selected}
          disabled={{ before: dayOf(todayIso()) }}
          dir={isRtl(locale) ? "rtl" : "ltr"}
          formatters={{
            formatCaption: (month) =>
              new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month),
            formatWeekdayName: (day) =>
              new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(day),
          }}
          onSelect={(day) => {
            if (!day) return;
            onChange(isoOf(day));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

const DaysPill: FC<{ days: number[]; onChange: (days: number[]) => void }> = ({
  days,
  onChange,
}) => {
  const t = useT();
  const locale = useLocale();
  const short = weekdayNames(locale, "short");
  const long = weekdayNames(locale, "long");
  const label =
    days.length === 0
      ? t("Days")
      : new Intl.ListFormat(locale, { type: "conjunction", style: "short" }).format(
          days.toSorted((a, b) => a - b).map((day) => short[day] ?? ""),
        );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={pill}>
        {label}
        <IconChevronDown className="text-muted-foreground size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className={menu}>
        {long.map((name, day) => (
          <DropdownMenuCheckboxItem
            key={name}
            checked={days.includes(day)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() =>
              onChange(
                days.includes(day) ? days.filter((chosen) => chosen !== day) : [...days, day],
              )
            }
          >
            {name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const sentenceParts = (text: string, nodes: Record<string, ReactNode>) =>
  text
    .split(/(\{\w+\})/u)
    .filter((part) => part.trim() !== "")
    .map((part, index) => {
      const name = /^\{(\w+)\}$/u.exec(part)?.[1];
      return (
        <Fragment key={`${index}${part}`}>
          {name ? nodes[name] : <span className="text-muted-foreground">{part.trim()}</span>}
        </Fragment>
      );
    });

const Sentence: FC<{
  draft: Draft;
  kind: Schedule["kind"];
  change: (update: Partial<Draft>) => void;
}> = ({ draft, kind: current, change }) => {
  const t = useT();
  const locale = useLocale();
  const kindPill = (
    <DropdownMenu>
      <DropdownMenuTrigger className={pill}>
        {kindTitles(t)[current]}
        <IconChevronDown className="text-muted-foreground size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className={cn(menu, "w-80")}>
        <KindItems kind={current} onPick={(picked) => change({ kind: picked })} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const time = (
    <TimePill value={draft.time} label={t("Time")} onChange={(next) => change({ time: next })} />
  );
  switch (current) {
    case "once":
      return sentenceParts(
        t("{kind} on {date} at {time}", { kind: "{kind}", date: "{date}", time: "{time}" }),
        {
          kind: kindPill,
          date: <DatePill value={draft.date} onChange={(date) => change({ date })} />,
          time,
        },
      );
    case "hourly":
      return sentenceParts(
        t("{kind} from {from} to {to}", { kind: "{kind}", from: "{from}", to: "{to}" }),
        {
          kind: kindPill,
          from: (
            <TimePill
              value={draft.from}
              label={t("From")}
              onChange={(next) => change({ from: next, to: draft.to < next ? next : draft.to })}
            />
          ),
          to: (
            <TimePill
              value={draft.to}
              label={t("To")}
              onChange={(next) => change({ to: next < draft.from ? draft.from : next })}
            />
          ),
        },
      );
    case "weekly":
      return sentenceParts(
        t("{kind} on {days} at {time}", { kind: "{kind}", days: "{days}", time: "{time}" }),
        {
          kind: kindPill,
          days: <DaysPill days={draft.days} onChange={(days) => change({ days })} />,
          time,
        },
      );
    case "monthly":
      return sentenceParts(
        t("{kind} on day {day} at {time}", { kind: "{kind}", day: "{day}", time: "{time}" }),
        {
          kind: kindPill,
          day: (
            <ChoicePill
              label={String(draft.day)}
              value={draft.day}
              choices={dayChoices(31)}
              onPick={(day) => change({ day })}
            />
          ),
          time,
        },
      );
    case "yearly":
      return sentenceParts(
        t("{kind} on {month} {day} at {time}", {
          kind: "{kind}",
          month: "{month}",
          day: "{day}",
          time: "{time}",
        }),
        {
          kind: kindPill,
          month: (
            <ChoicePill
              label={monthNames(locale, "short")[draft.month - 1] ?? ""}
              value={draft.month}
              choices={monthNames(locale, "long").map((label, index) => ({
                value: index + 1,
                label,
              }))}
              onPick={(month) => change({ month, day: Math.min(draft.day, daysIn(month)) })}
            />
          ),
          day: (
            <ChoicePill
              label={String(draft.day)}
              value={draft.day}
              choices={dayChoices(daysIn(draft.month))}
              onPick={(day) => change({ day })}
            />
          ),
          time,
        },
      );
    case "daily":
      return sentenceParts(t("{kind} at {time}", { kind: "{kind}", time: "{time}" }), {
        kind: kindPill,
        time,
      });
  }
};

export const TriggerField: FC<{ draft: Draft; change: (update: Partial<Draft>) => void }> = ({
  draft,
  change,
}) => {
  const t = useT();
  if (draft.kind === undefined) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(pill, "w-fit pe-3")}>
          <IconPlus className="size-3.5" />
          {t("Add trigger")}
        </DropdownMenuTrigger>
        <DropdownMenuContent className={cn(menu, "w-80")}>
          <KindItems kind={undefined} onPick={(kind) => change({ kind })} />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <Sentence draft={draft} kind={draft.kind} change={change} />
      <button
        type="button"
        aria-label={t("Remove trigger")}
        title={t("Remove trigger")}
        onClick={() => change({ kind: undefined })}
        className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-7 items-center justify-center rounded-full"
      >
        <IconX className="size-3.5" />
      </button>
    </div>
  );
};
