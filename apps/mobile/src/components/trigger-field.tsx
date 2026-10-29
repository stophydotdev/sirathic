import { type Draft, isoOf, todayIso } from "@sirathic/app/automationDraft";
import type { Schedule } from "@sirathic/server/automations";
import { type FC, type ReactNode, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  clockParts,
  clockText,
  dateText,
  dayList,
  dayOf,
  MONTHS,
  WEEKDAYS,
} from "@/lib/automations";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Plus, X } from "./icons";
import { Menu, menuRow, menuText } from "./menu";

type Kind = Schedule["kind"];

const KINDS = {
  once: { title: "Once", hint: "On a date and time" },
  hourly: { title: "Hourly", hint: "Every hour within hours" },
  daily: { title: "Daily", hint: "Every day at a time" },
  weekly: { title: "Weekly", hint: "On chosen days" },
  monthly: { title: "Monthly", hint: "On a chosen day" },
  yearly: { title: "Yearly", hint: "Every year on a date" },
} satisfies Record<Kind, { title: string; hint: string }>;

const ORDER = ["once", "hourly", "daily", "weekly", "monthly", "yearly"] as const satisfies Kind[];

const LEAP_YEAR = 2024;

const daysIn = (month: number) => new Date(LEAP_YEAR, month, 0).getDate();

const pill =
  "bg-foreground/8 active:bg-foreground/15 h-8 flex-row items-center gap-1 rounded-md px-2.5";

const PillText: FC<{ children: string }> = ({ children }) => (
  <>
    <Text className="text-foreground font-medium text-sm">{children}</Text>
    <ChevronDown size={18} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
  </>
);

const Words: FC<{ children: string }> = ({ children }) => (
  <Text className="text-muted-foreground font-sans text-sm">{children}</Text>
);

const List: FC<{ children: ReactNode }> = ({ children }) => (
  <ScrollView className="max-h-64" nestedScrollEnabled>
    {children}
  </ScrollView>
);

const Option: FC<{ label: string; chosen: boolean; onPress: () => void }> = ({
  label,
  chosen,
  onPress,
}) => (
  <Pressable onPress={onPress} className={menuRow}>
    <Text className={`${menuText} flex-1`}>{label}</Text>
    {chosen && <Check size={20} strokeWidth={1.75} colorClassName="accent-foreground" />}
  </Pressable>
);

const KindMenu: FC<{
  kind: Kind | undefined;
  trigger: ReactNode;
  onPick: (kind: Kind) => void;
}> = ({ kind, trigger, onPick }) => (
  <Menu label="Trigger" trigger={trigger} triggerClassName={pill} contentClassName="w-72">
    {(close) =>
      ORDER.map((option) => (
        <Pressable
          key={option}
          onPress={() => {
            onPick(option);
            close();
          }}
          className={menuRow}
        >
          <Text className="text-foreground font-medium w-16 text-sm">{KINDS[option].title}</Text>
          <Text className="text-muted-foreground font-sans flex-1 text-xs">
            {KINDS[option].hint}
          </Text>
          {option === kind && (
            <Check size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
          )}
        </Pressable>
      ))
    }
  </Menu>
);

const ChoicePill: FC<{
  label: string;
  value: number;
  choices: readonly (readonly [number, string])[];
  onPick: (value: number) => void;
}> = ({ label, value, choices, onPick }) => (
  <Menu
    label={label}
    trigger={<PillText>{label}</PillText>}
    triggerClassName={pill}
    contentClassName="w-44"
  >
    {(close) => (
      <List>
        {choices.map(([choice, name]) => (
          <Option
            key={choice}
            label={name}
            chosen={choice === value}
            onPress={() => {
              onPick(choice);
              close();
            }}
          />
        ))}
      </List>
    )}
  </Menu>
);

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 12 }, (_, step) => step * 5);
const pad = (part: number) => String(part).padStart(2, "0");
const ROW = 40;
const startAt = (index: number) => ({ x: 0, y: Math.max(0, (index - 2) * ROW) });

const TimePill: FC<{ value: string; label: string; onChange: (time: string) => void }> = ({
  value,
  label,
  onChange,
}) => {
  const { hour, minute } = clockParts(value);
  return (
    <Menu
      label={label}
      trigger={<PillText>{clockText(value)}</PillText>}
      triggerClassName={pill}
      contentClassName="w-56"
    >
      {() => (
        <View className="flex-row gap-1">
          <ScrollView className="max-h-64 flex-1" contentOffset={startAt(hour)} nestedScrollEnabled>
            {HOURS.map((option) => (
              <Option
                key={option}
                label={clockText(`${pad(option)}:00`).replace(/:00/u, "")}
                chosen={option === hour}
                onPress={() => onChange(`${pad(option)}:${pad(minute)}`)}
              />
            ))}
          </ScrollView>
          <ScrollView
            className="max-h-64 flex-1"
            contentOffset={startAt(minute / 5)}
            nestedScrollEnabled
          >
            {MINUTES.map((option) => (
              <Option
                key={option}
                label={`:${pad(option)}`}
                chosen={option === minute}
                onPress={() => onChange(`${pad(hour)}:${pad(option)}`)}
              />
            ))}
          </ScrollView>
        </View>
      )}
    </Menu>
  );
};

const DaysPill: FC<{ days: number[]; onChange: (days: number[]) => void }> = ({
  days,
  onChange,
}) => (
  <Menu
    label="Days"
    trigger={<PillText>{days.length === 0 ? "Days" : dayList(days)}</PillText>}
    triggerClassName={pill}
    contentClassName="w-48"
  >
    {() =>
      WEEKDAYS.map((name, day) => (
        <Option
          key={name}
          label={name}
          chosen={days.includes(day)}
          onPress={() =>
            onChange(days.includes(day) ? days.filter((chosen) => chosen !== day) : [...days, day])
          }
        />
      ))
    }
  </Menu>
);

const Calendar: FC<{ value: string; onPick: (date: string) => void }> = ({ value, onPick }) => {
  const [month, setMonth] = useState(() => {
    const day = dayOf(value);
    return new Date(day.getFullYear(), day.getMonth(), 1);
  });
  const today = todayIso();
  const blanks = month.getDay();
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: blanks }, () => undefined),
    ...Array.from(
      { length: count },
      (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1),
    ),
  ];
  const step = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));
  return (
    <View className="gap-2 p-1">
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityLabel="Previous month"
          onPress={() => step(-1)}
          className="active:bg-muted size-8 items-center justify-center rounded-md"
        >
          <ChevronLeft size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
        </Pressable>
        <Text className="text-foreground font-medium text-sm">
          {`${MONTHS[month.getMonth()]} ${month.getFullYear()}`}
        </Text>
        <Pressable
          accessibilityLabel="Next month"
          onPress={() => step(1)}
          className="active:bg-muted size-8 items-center justify-center rounded-md"
        >
          <ChevronRight size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
        </Pressable>
      </View>
      <View className="flex-row flex-wrap">
        {WEEKDAYS.map((name) => (
          <Text key={name} className="text-muted-foreground font-sans w-1/7 text-center text-xs">
            {name.charAt(0)}
          </Text>
        ))}
        {cells.map((day, index) => {
          if (!day) return <View key={`blank${index}`} className="h-9 w-1/7" />;
          const iso = isoOf(day);
          const past = iso < today;
          return (
            <Pressable
              key={iso}
              disabled={past}
              onPress={() => onPick(iso)}
              className={`h-9 w-1/7 items-center justify-center rounded-full ${iso === value ? "bg-foreground" : "active:bg-muted"}`}
            >
              <Text
                className={`font-sans text-sm ${iso === value ? "text-background" : past ? "text-muted-foreground/50" : "text-foreground"}`}
              >
                {day.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const DatePill: FC<{ value: string; onChange: (date: string) => void }> = ({ value, onChange }) => (
  <Menu
    label="Date"
    trigger={<PillText>{dateText(dayOf(value))}</PillText>}
    triggerClassName={pill}
    contentClassName="w-72"
  >
    {(close) => (
      <Calendar
        value={value}
        onPick={(date) => {
          onChange(date);
          close();
        }}
      />
    )}
  </Menu>
);

const Sentence: FC<{ draft: Draft; kind: Kind; change: (update: Partial<Draft>) => void }> = ({
  draft,
  kind,
  change,
}) => {
  const kindPill = (
    <KindMenu
      kind={kind}
      trigger={<PillText>{KINDS[kind].title}</PillText>}
      onPick={(picked) => change({ kind: picked })}
    />
  );
  const time = (
    <TimePill value={draft.time} label="Time" onChange={(next) => change({ time: next })} />
  );
  switch (kind) {
    case "once":
      return (
        <>
          {kindPill}
          <Words>on</Words>
          <DatePill value={draft.date} onChange={(date) => change({ date })} />
          <Words>at</Words>
          {time}
        </>
      );
    case "hourly":
      return (
        <>
          {kindPill}
          <Words>from</Words>
          <TimePill
            value={draft.from}
            label="From"
            onChange={(next) => change({ from: next, to: draft.to < next ? next : draft.to })}
          />
          <Words>to</Words>
          <TimePill
            value={draft.to}
            label="To"
            onChange={(next) => change({ to: next < draft.from ? draft.from : next })}
          />
        </>
      );
    case "daily":
      return (
        <>
          {kindPill}
          <Words>at</Words>
          {time}
        </>
      );
    case "weekly":
      return (
        <>
          {kindPill}
          <Words>on</Words>
          <DaysPill days={draft.days} onChange={(days) => change({ days })} />
          <Words>at</Words>
          {time}
        </>
      );
    case "monthly":
      return (
        <>
          {kindPill}
          <Words>on day</Words>
          <ChoicePill
            label={String(draft.day)}
            value={draft.day}
            choices={Array.from(
              { length: 31 },
              (_, index) => [index + 1, String(index + 1)] as const,
            )}
            onPick={(day) => change({ day })}
          />
          <Words>at</Words>
          {time}
        </>
      );
    case "yearly":
      return (
        <>
          {kindPill}
          <Words>on</Words>
          <ChoicePill
            label={MONTHS[draft.month - 1]?.slice(0, 3) ?? ""}
            value={draft.month}
            choices={MONTHS.map((name, index) => [index + 1, name] as const)}
            onPick={(month) => change({ month, day: Math.min(draft.day, daysIn(month)) })}
          />
          <ChoicePill
            label={String(draft.day)}
            value={draft.day}
            choices={Array.from(
              { length: daysIn(draft.month) },
              (_, index) => [index + 1, String(index + 1)] as const,
            )}
            onPick={(day) => change({ day })}
          />
          <Words>at</Words>
          {time}
        </>
      );
  }
};

export const TriggerField: FC<{ draft: Draft; change: (update: Partial<Draft>) => void }> = ({
  draft,
  change,
}) => {
  if (draft.kind === undefined) {
    return (
      <View className="flex-row">
        <KindMenu
          kind={undefined}
          trigger={
            <>
              <Plus size={18} strokeWidth={1.75} colorClassName="accent-foreground" />
              <Text className="text-foreground font-medium text-sm">Add trigger</Text>
            </>
          }
          onPick={(kind) => change({ kind })}
        />
      </View>
    );
  }
  return (
    <View className="flex-row flex-wrap items-center gap-1.5">
      <Sentence draft={draft} kind={draft.kind} change={change} />
      <Pressable
        accessibilityLabel="Remove trigger"
        onPress={() => change({ kind: undefined })}
        className="active:bg-muted size-7 items-center justify-center rounded-full"
      >
        <X size={18} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
      </Pressable>
    </View>
  );
};
