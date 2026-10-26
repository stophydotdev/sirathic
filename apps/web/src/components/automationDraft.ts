import type { Automation, Schedule } from "@/components/automationText";

export type Draft = {
  name: string;
  prompt: string;
  icon: Automation["icon"];
  mode: Automation["mode"];
  notify: Automation["notify"];
  kind: Schedule["kind"] | undefined;
  date: string;
  time: string;
  from: string;
  to: string;
  days: number[];
  day: number;
  month: number;
};

const pad = (part: number) => String(part).padStart(2, "0");

export const isoOf = (day: Date) =>
  [day.getFullYear(), pad(day.getMonth() + 1), pad(day.getDate())].join("-");

export const todayIso = () => isoOf(new Date());

export const blankDraft = (): Draft => {
  const now = new Date();
  return {
    name: "",
    prompt: "",
    icon: null,
    mode: "quick",
    notify: "app",
    kind: undefined,
    date: todayIso(),
    time: "09:00",
    from: "09:00",
    to: "17:00",
    days: [1],
    day: now.getDate(),
    month: now.getMonth() + 1,
  };
};

export const draftOf = (automation: Automation): Draft => {
  const { schedule } = automation;
  return {
    ...blankDraft(),
    name: automation.name,
    prompt: automation.prompt,
    icon: automation.icon,
    mode: automation.mode,
    notify: automation.notify,
    kind: schedule.kind,
    ...(schedule.kind === "hourly" && { from: schedule.from, to: schedule.to }),
    ...("time" in schedule && { time: schedule.time }),
    ...(schedule.kind === "once" && { date: schedule.date }),
    ...(schedule.kind === "weekly" && { days: schedule.days }),
    ...(schedule.kind === "monthly" && { day: schedule.day }),
    ...(schedule.kind === "yearly" && { month: schedule.month, day: schedule.day }),
  };
};

export const scheduleOf = (draft: Draft): Schedule | undefined => {
  switch (draft.kind) {
    case undefined:
      return undefined;
    case "once":
      return { kind: "once", date: draft.date, time: draft.time };
    case "hourly":
      return { kind: "hourly", from: draft.from, to: draft.to };
    case "daily":
      return { kind: "daily", time: draft.time };
    case "weekly":
      return { kind: "weekly", days: draft.days, time: draft.time };
    case "monthly":
      return { kind: "monthly", day: draft.day, time: draft.time };
    case "yearly":
      return { kind: "yearly", month: draft.month, day: draft.day, time: draft.time };
  }
};

export const isComplete = (draft: Draft) => {
  const plan = scheduleOf(draft);
  if (!plan || draft.name.trim() === "" || draft.prompt.trim() === "") return false;
  switch (plan.kind) {
    case "once":
      return plan.date !== "" && plan.time !== "";
    case "hourly":
      return plan.from !== "" && plan.to >= plan.from;
    case "weekly":
      return plan.days.length > 0 && plan.time !== "";
    default:
      return plan.time !== "";
  }
};
