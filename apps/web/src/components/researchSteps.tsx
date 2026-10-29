"use client";

import { isCardTool } from "@/components/automationCard";
import { Favicon } from "@/components/favicon";
import { Fold } from "@/components/fold";
import { MentionIcon } from "@/components/mentionIcon";
import type { MentionTarget } from "@/components/mentionText";
import { usePluginTargets } from "@/components/mentions";
import { researchOf, type ResearchStep } from "@/components/research";
import { type Translate, useT } from "@/components/i18n";
import { cn } from "@/lib/utils";
import { type ThreadMessage, useAuiState } from "@assistant-ui/react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Book02Icon,
  Bookmark02Icon,
  BulbIcon,
  Clock04Icon,
  FavouriteIcon,
  Globe02Icon,
  NewTwitterIcon,
  Search01Icon,
  SourceCodeIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { type FC, type ReactNode, useEffect, useState } from "react";

type Part = ThreadMessage["content"][number];

type Item = { icon: ReactNode; text: string };

function useElapsed(startedAt: number, running: boolean) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(performance.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return (now - startedAt) / 1000;
}

const TOOLS = new Map<
  string,
  {
    Icon: IconSvgElement;
    label: (t: Translate, detail: string) => string;
    done: (t: Translate) => string;
  }
>([
  [
    "search_duas",
    {
      Icon: FavouriteIcon,
      label: (t, d) => t("Finding duas for {detail}", { detail: d }),
      done: (t) => t("Found duas"),
    },
  ],
  [
    "update_memory",
    {
      Icon: Bookmark02Icon,
      label: (t) => t("Saved to your preferences"),
      done: (t) => t("Saved to your preferences"),
    },
  ],
  ["load_skill", { Icon: Book02Icon, label: (t) => t("Skills"), done: (t) => t("Skills") }],
  [
    "search_past_chats",
    {
      Icon: Clock04Icon,
      label: (t) => t("Searching your past chats"),
      done: (t) => t("Searched your past chats"),
    },
  ],
  [
    "search_x",
    { Icon: NewTwitterIcon, label: (t) => t("Searching X"), done: (t) => t("Searched X") },
  ],
  [
    "stophy_search_endpoints",
    {
      Icon: Search01Icon,
      label: (t, d) =>
        d ? t("Searching Stophy for {detail}", { detail: d }) : t("Checking Stophy…"),
      done: (t) => t("Read from Stophy"),
    },
  ],
  [
    "stophy_call",
    { Icon: Globe02Icon, label: (t) => t("Read from Stophy"), done: (t) => t("Read from Stophy") },
  ],
]);

const iconOf = (icon: IconSvgElement) => (
  <HugeiconsIcon icon={icon} className="text-foreground/70 size-4 shrink-0" />
);

const itemsOf = (
  t: Translate,
  steps: ResearchStep[],
  targetOf: (plugin: string) => MentionTarget,
): Item[] => {
  const searches = steps.reduce(
    (count, step) => (step.kind === "searches" ? count + step.queries.length : count),
    0,
  );
  const pages = steps.filter((step) => step.kind === "browse").length;
  const ranCode = steps.some((step) => step.kind === "code");
  const verses = steps.flatMap((step) => (step.kind === "verses" ? [step.title] : []));
  const used = steps.flatMap((step): Item[] => {
    if (step.kind === "plugin") {
      const target = targetOf(step.plugin);
      return [
        { icon: <MentionIcon target={target} />, text: t("Used {name}", { name: target.name }) },
      ];
    }
    const tool = step.kind === "tool" ? TOOLS.get(step.tool) : undefined;
    return tool ? [{ icon: iconOf(tool.Icon), text: tool.done(t) }] : [];
  });
  return [
    ...(searches > 0
      ? [
          {
            icon: iconOf(Search01Icon),
            text:
              searches === 1 ? t("Ran 1 search") : t("Ran {count} searches", { count: searches }),
          },
        ]
      : []),
    ...(pages > 0
      ? [
          {
            icon: iconOf(Globe02Icon),
            text: pages === 1 ? t("Browsed 1 page") : t("Browsed {count} pages", { count: pages }),
          },
        ]
      : []),
    ...(ranCode ? [{ icon: iconOf(SourceCodeIcon), text: t("Ran code") }] : []),
    ...(verses.length > 0
      ? [{ icon: iconOf(Book02Icon), text: `${t("Read")} ${verses.join(", ")}` }]
      : []),
    ...new Map(used.map((item) => [item.text, item])).values(),
  ];
};

const siteOf = (url: string) => URL.parse(url)?.hostname.replace(/^www\./u, "") ?? url;

const nowOf = (
  t: Translate,
  step: ResearchStep,
  targetOf: (plugin: string) => MentionTarget,
): Item => {
  switch (step.kind) {
    case "think":
      return { icon: iconOf(BulbIcon), text: step.text || t("Thinking") };
    case "searches": {
      const query = step.queries.at(-1);
      return {
        icon: iconOf(Search01Icon),
        text: query ? t("Searching “{query}”", { query }) : t("Working"),
      };
    }
    case "browse":
      return {
        icon: <Favicon url={step.url} size={16} />,
        text: t("Reading {name}", { name: siteOf(step.url) }),
      };
    case "verses":
      return { icon: iconOf(Book02Icon), text: t("Reading {name}", { name: step.title }) };
    case "code":
      return { icon: iconOf(SourceCodeIcon), text: t("Running code") };
    case "plugin": {
      const target = targetOf(step.plugin);
      const call = step.calls.at(-1);
      return {
        icon: <MentionIcon target={target} />,
        text: t("Using {name}", {
          name: call ? `${target.name}: ${call.tool.replaceAll("_", " ")}` : target.name,
        }),
      };
    }
    case "tool": {
      const tool = TOOLS.get(step.tool);
      return {
        icon: iconOf(tool?.Icon ?? SparklesIcon),
        text: tool ? tool.label(t, step.detail) : step.tool,
      };
    }
    default: {
      const unknownStep: never = step;
      return unknownStep;
    }
  }
};

const isResearch = (part: Part) =>
  part.type === "reasoning" ||
  (part.type === "tool-call" && !isCardTool(part.toolName) && !part.approval);

export const Research: FC<{ indices: readonly number[]; startedAt: number }> = ({
  indices,
  startedAt,
}) => {
  const parts = useAuiState((s) => s.message.parts);
  const timing = useAuiState((s) => s.message.metadata.timing);
  const streaming = useAuiState((s) => s.message.status?.type === "running");
  const last = parts.at(-1);
  const working =
    streaming &&
    (last === undefined ||
      isResearch(last) ||
      !parts.some((part) => part.type === "text" && part.text));
  const thinking = working && last?.type === "reasoning";
  const [live] = useState(working);
  const [open, setOpen] = useState(false);
  const t = useT();
  const targetOf = usePluginTargets();
  const elapsed = useElapsed(startedAt, working);
  const first = parts.findIndex(isResearch);
  if (indices.length > 0 && indices[0] !== first) return null;
  const steps = researchOf(parts.filter(isResearch), thinking);
  if (steps.length === 0 && !working) return null;

  if (working) {
    const step = steps.at(-1);
    const now = step ? nowOf(t, step, targetOf) : undefined;
    return (
      <p className="text-muted-foreground mb-4 flex h-6 min-w-0 items-center gap-2 text-sm">
        {now?.icon}
        <span className="shimmer min-w-0 truncate">{now?.text ?? t("Working")}</span>
        <span className="text-muted-foreground/70 shrink-0 tabular-nums">
          {t("{seconds}s", { seconds: Math.max(1, Math.round(elapsed)) })}
        </span>
      </p>
    );
  }

  const items = itemsOf(t, steps, targetOf);
  const seconds = live
    ? Math.max(1, Math.round(elapsed))
    : timing?.firstTokenTime === undefined
      ? undefined
      : Math.max(1, Math.round((timing.firstTokenTime - timing.streamStartTime) / 1000));

  return (
    <div className="mb-4 flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        disabled={items.length === 0}
        className="text-muted-foreground enabled:hover:text-foreground flex h-6 items-center gap-1 self-start text-sm tabular-nums transition-colors"
      >
        {seconds === undefined ? t("Finished") : t("Finished {seconds}s", { seconds })}
        {items.length > 0 && (
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-300 ease-out-quint rtl:rotate-180 motion-reduce:transition-none",
              open && "rotate-90 rtl:rotate-90",
            )}
          />
        )}
      </button>
      <Fold open={open} className="border-border ms-1.5 mt-1.5 gap-1.5 border-s ps-3">
        {items.map((item) => (
          <div
            key={item.text}
            className="text-muted-foreground flex h-6 min-w-0 items-center gap-2 text-sm"
          >
            {item.icon}
            <span className="min-w-0 truncate">{item.text}</span>
          </div>
        ))}
      </Fold>
    </div>
  );
};
