"use client";

import { Favicon } from "@/components/favicon";
import { type ResearchStep, readableQuery, stepsOf } from "@/components/research";
import { siteName } from "@/components/sources";
import { type Translate, useT } from "@/components/i18n";
import { cn } from "@/lib/utils";
import { useAuiState } from "@assistant-ui/react";
import {
  IconBook,
  IconCalculator,
  IconCalendar,
  IconChevronDown,
  IconCompass,
  IconHeartHandshake,
  IconMapPin,
  IconMessage,
  IconScale,
  IconScript,
  IconSearch,
  IconSparkles,
  IconSun,
  IconTool,
  IconTrendingUp,
} from "@tabler/icons-react";
import { type FC, type ReactNode, useEffect, useState } from "react";

function useElapsed(startedAt: number, running: boolean) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(performance.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return (now - startedAt) / 1000;
}

export const Research: FC<{
  running: boolean;
  indices: readonly number[];
  startedAt: number;
}> = ({ running, indices, startedAt }) => {
  const parts = useAuiState((s) => s.message.parts);
  const timing = useAuiState((s) => s.message.metadata.timing);
  const composing = useAuiState(
    (s) =>
      s.message.status?.type === "running" &&
      !s.message.parts.some((part) => part.type === "text" && part.text),
  );
  const working = running || composing;
  const [live] = useState(working);
  const t = useT();
  const [open, setOpen] = useState(false);
  const elapsed = useElapsed(startedAt, working);
  const steps = stepsOf(indices.map((i) => parts[i]).filter((part) => part !== undefined));
  const researched = live
    ? Math.max(1, Math.round(elapsed))
    : timing?.firstTokenTime === undefined
      ? undefined
      : Math.max(1, Math.round((timing.firstTokenTime - timing.streamStartTime) / 1000));
  const seconds = working
    ? Math.floor(elapsed) > 0
      ? Math.floor(elapsed)
      : undefined
    : researched;
  const latest = steps.at(-1);

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={steps.length === 0}
        className="text-muted-foreground enabled:hover:text-foreground flex items-center gap-1 text-sm"
      >
        {working ? t("Researching") : t("Researched")}
        {seconds !== undefined && (
          <span className="text-muted-foreground/70 tabular-nums">{seconds}s</span>
        )}
        {steps.length > 0 && (
          <IconChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
        )}
      </button>
      {open ? (
        <div className="relative pt-3 ps-[19px]">
          <span className="bg-border absolute top-3 bottom-1 start-[6px] w-px" />
          <div className="grid gap-4">
            {steps.map((step, i) => (
              <StepRow key={i} step={step} />
            ))}
          </div>
        </div>
      ) : (
        working &&
        latest && (
          <div className="pt-3">
            <StepRow step={latest} />
          </div>
        )
      )}
    </div>
  );
};

const quran = <IconBook className="size-4" />;
const hadith = <IconScript className="size-4" />;
const fiqh = <IconScale className="size-4" />;
const calculator = <IconCalculator className="size-4" />;
const calendar = <IconCalendar className="size-4" />;
const place = <IconMapPin className="size-4" />;

const TOOL_STEPS = new Map<
  string,
  { icon: ReactNode; label: (t: Translate, detail: string) => string }
>([
  [
    "quranSearch",
    {
      icon: quran,
      label: (t, d) => t("Searching the Quran for {detail}", { detail: d }),
    },
  ],
  ["quranGet", { icon: quran, label: (t) => t("Reading the Quran") }],
  [
    "hadithSearch",
    {
      icon: hadith,
      label: (t, d) => t("Searching hadith for {detail}", { detail: d }),
    },
  ],
  ["hadithGet", { icon: hadith, label: (t) => t("Reading hadith") }],
  [
    "hadithCheck",
    {
      icon: hadith,
      label: (t, d) => t("Checking the hadith {detail}", { detail: d }),
    },
  ],
  [
    "fiqhSearch",
    {
      icon: fiqh,
      label: (t, d) => t("Searching fiqh books for {detail}", { detail: d }),
    },
  ],
  ["fiqhGet", { icon: fiqh, label: (t) => t("Reading fiqh books") }],
  [
    "duaSearch",
    {
      icon: <IconHeartHandshake className="size-4" />,
      label: (t, d) => t("Finding duas for {detail}", { detail: d }),
    },
  ],
  ["namedReference", { icon: quran, label: (t, d) => t("Looking up {detail}", { detail: d }) }],
  ["namesOfAllah", { icon: quran, label: (t) => t("Looking up the names of Allah") }],
  [
    "prayerTimes",
    {
      icon: <IconSun className="size-4" />,
      label: (t) => t("Calculating prayer times"),
    },
  ],
  [
    "qibla",
    {
      icon: <IconCompass className="size-4" />,
      label: (t) => t("Finding the qibla"),
    },
  ],
  ["hijriDate", { icon: calendar, label: (t) => t("Converting the date") }],
  ["islamicCalendar", { icon: calendar, label: (t) => t("Checking the Islamic calendar") }],
  ["geocode", { icon: place, label: (t, d) => t("Finding {detail}", { detail: d }) }],
  [
    "redditThread",
    {
      icon: <IconMessage className="size-4" />,
      label: (t) => t("Reading a Reddit thread"),
    },
  ],
  ["zakatCalculator", { icon: calculator, label: (t) => t("Calculating zakat") }],
  ["zakatAlFitr", { icon: calculator, label: (t) => t("Calculating zakat al-fitr") }],
  ["fidyaKaffarah", { icon: calculator, label: (t) => t("Calculating fidya and kaffarah") }],
  ["inheritance", { icon: calculator, label: (t) => t("Calculating inheritance shares") }],
  ["islamicUnits", { icon: calculator, label: (t) => t("Converting units") }],
  [
    "calculator",
    {
      icon: calculator,
      label: (t, d) => t("Calculating {detail}", { detail: d }),
    },
  ],
  [
    "halalStockScreen",
    {
      icon: <IconTrendingUp className="size-4" />,
      label: (t, d) => t("Screening {detail}", { detail: d }),
    },
  ],
]);

const chip =
  "bg-muted text-muted-foreground flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs";

const line = (icon: ReactNode, label: string, chips?: ReactNode) => (
  <div className="flex min-w-0 flex-col gap-2">
    <div className="text-muted-foreground flex min-w-0 items-center gap-2 text-sm">
      <span className="bg-background flex size-5 shrink-0 items-center justify-center rounded-full">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </div>
    {chips && <div className="flex flex-wrap gap-1.5 ps-7">{chips}</div>}
  </div>
);

const StepRow: FC<{ step: ResearchStep }> = ({ step }) => {
  const t = useT();
  switch (step.kind) {
    case "think":
      return line(<IconSparkles className="size-4" />, step.text);
    case "search":
      return line(
        <IconSearch className="size-4" />,
        t("Searching"),
        step.queries.map((query) => (
          <span key={query} className={chip}>
            <IconSearch className="size-3 shrink-0" />
            <span className="truncate">{readableQuery(query)}</span>
          </span>
        )),
      );
    case "read":
      return line(
        <IconBook className="size-4" />,
        t("Reading"),
        step.urls.map((url) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            className={cn(chip, "hover:text-foreground")}
          >
            <Favicon url={url} size={12} />
            <span className="truncate">{siteName(url)}</span>
          </a>
        )),
      );
    case "tool": {
      const tool = TOOL_STEPS.get(step.tool);
      return line(
        tool?.icon ?? <IconTool className="size-4" />,
        tool ? tool.label(t, step.detail) : step.tool,
      );
    }
    default: {
      const unknownStep: never = step;
      return unknownStep;
    }
  }
};
