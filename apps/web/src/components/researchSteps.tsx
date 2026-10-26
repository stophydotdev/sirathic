"use client";

import { Favicon } from "@/components/favicon";
import { type Read, researchOf, type ResearchStep, type SearchSource } from "@/components/research";
import { type Translate, useT } from "@/components/i18n";
import { cn } from "@/lib/utils";
import { useAuiState } from "@assistant-ui/react";
import {
  IconBook,
  IconBookmark,
  IconBulb,
  IconChevronRight,
  IconFileDescription,
  IconFileText,
  IconHeart,
  IconLoader2,
  IconScale,
  IconSearch,
  IconSparkles,
  IconWorld,
  type TablerIcon,
} from "@tabler/icons-react";
import { type FC, type ReactNode, useEffect, useState } from "react";

const REVEAL_MS = 400;
const COUNT_MS = 300;
const appear =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 duration-300";

function useElapsed(startedAt: number, running: boolean) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(performance.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return (now - startedAt) / 1000;
}

function useRevealed(total: number, live: boolean) {
  const [revealed, setRevealed] = useState(live ? total : Number.POSITIVE_INFINITY);
  useEffect(() => {
    if (revealed >= total) return;
    const timer = setTimeout(() => setRevealed((count) => count + 1), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [revealed, total]);
  return revealed;
}

const summaryOf = (t: Translate, steps: ResearchStep[]) => {
  const searches = steps.reduce(
    (count, step) => (step.kind === "searches" ? count + step.queries.length : count),
    0,
  );
  const pages = steps.filter((step) => step.kind === "browse").length;
  const verses = steps.flatMap((step) => (step.kind === "verses" ? [step.title] : []));
  const tools = steps.flatMap((step) =>
    step.kind === "tool" ? (TOOLS.get(step.tool)?.done(t) ?? []) : [],
  );
  return [
    ...(searches > 0
      ? [searches === 1 ? t("Ran 1 search") : t("Ran {count} searches", { count: searches })]
      : []),
    ...(pages > 0
      ? [pages === 1 ? t("Browsed 1 page") : t("Browsed {count} pages", { count: pages })]
      : []),
    ...(verses.length > 0 ? [`${t("Read")} ${verses.join(", ")}`] : []),
    ...new Set(tools),
  ].join(" · ");
};

const THINKING: ResearchStep = { kind: "think", text: "", live: true };

const isResearch = (part: { type: string }) =>
  part.type === "reasoning" || part.type === "tool-call";

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
  const elapsed = useElapsed(startedAt, working);
  const steps = researchOf(parts.filter(isResearch), thinking);
  const revealed = useRevealed(steps.length, live);
  const first = parts.findIndex(isResearch);
  if (indices.length > 0 && indices[0] !== first) return null;

  const visible = steps.slice(0, revealed);
  const busy = working || revealed < steps.length;
  const toolRunning = last?.type === "tool-call" && last.result === undefined;
  const lastVisible = visible.at(-1);
  const thinkingShown = lastVisible?.kind === "think" && lastVisible.live;
  const rows =
    working && !thinkingShown && (!toolRunning || visible.length === 0)
      ? [...visible, THINKING]
      : visible;
  const summary = streaming || open ? "" : summaryOf(t, steps);
  const researched = live
    ? Math.max(1, Math.round(elapsed))
    : timing?.firstTokenTime === undefined
      ? undefined
      : Math.max(1, Math.round((timing.firstTokenTime - timing.streamStartTime) / 1000));

  return (
    <div className="mb-4 flex flex-col gap-2">
      {(streaming || open) &&
        rows.map((step, i) => (
          <StepRow key={i} step={step} active={busy && i === rows.length - 1} animate={busy} />
        ))}
      {busy ? (
        <div className={cn("text-muted-foreground flex h-6 items-center gap-2 text-sm", appear)}>
          <IconLoader2
            stroke={1.5}
            className="text-foreground/70 size-4 shrink-0 motion-safe:animate-spin"
          />
          <span className="shimmer tabular-nums">
            {t("Working for {seconds}s", { seconds: Math.max(1, Math.round(elapsed)) })}
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={streaming || steps.length === 0}
          className="text-muted-foreground enabled:hover:text-foreground flex h-6 min-w-0 items-center gap-1 self-start text-sm transition-colors"
        >
          <span className="shrink-0 tabular-nums">
            {researched === undefined
              ? t("Researched")
              : t("Worked for {seconds}s", { seconds: researched })}
          </span>
          {summary && <span className="text-muted-foreground/70 truncate">· {summary}</span>}
          {!streaming && steps.length > 0 && (
            <IconChevronRight
              className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")}
            />
          )}
        </button>
      )}
    </div>
  );
};

const Row: FC<{
  Icon: TablerIcon;
  active?: boolean;
  code?: string;
  href?: string;
  aside?: ReactNode;
  children: ReactNode;
}> = ({ Icon, active, code, href, aside, children }) => (
  <div className={cn("text-muted-foreground flex h-6 min-w-0 items-center gap-2 text-sm", appear)}>
    <Icon stroke={1.5} className="text-foreground/70 size-4 shrink-0" />
    <span className={cn(code ? "shrink-0" : "min-w-0 truncate", active && "shimmer")}>
      {children}
    </span>
    {code &&
      (href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground min-w-0 truncate font-normal! no-underline! transition-colors"
        >
          {code}
        </a>
      ) : (
        <span className="min-w-0 truncate">{code}</span>
      ))}
    {aside}
  </div>
);

const READ_ICONS = {
  quran: IconBook,
  hadith: IconFileText,
  fiqh: IconScale,
  fatwa: IconFileDescription,
  web: IconWorld,
  news: IconWorld,
} satisfies Record<SearchSource, TablerIcon>;

const TOOLS = new Map<
  string,
  {
    Icon: TablerIcon;
    label: (t: Translate, detail: string) => string;
    done: (t: Translate) => string;
  }
>([
  [
    "duaSearch",
    {
      Icon: IconHeart,
      label: (t, d) => t("Finding duas for {detail}", { detail: d }),
      done: (t) => t("Found duas"),
    },
  ],
  [
    "remember",
    {
      Icon: IconBookmark,
      label: (t) => t("Saved to your preferences"),
      done: (t) => t("Saved to your preferences"),
    },
  ],
]);

const pageOf = (url: string) => {
  const parsed = URL.parse(url);
  return parsed
    ? `${parsed.hostname.replace(/^www\./u, "")}${parsed.pathname.replace(/\/$/u, "")}`
    : url;
};

function useCountUp(target: number, animate: boolean) {
  const [shown, setShown] = useState(animate ? 1 : target);
  useEffect(() => {
    if (shown >= target) return;
    const timer = setTimeout(() => setShown((count) => count + 1), COUNT_MS);
    return () => clearTimeout(timer);
  }, [shown, target]);
  return Math.min(shown, target);
}

const SearchesRow: FC<{
  queries: string[];
  results: Read[];
  done: boolean;
  active: boolean;
  animate: boolean;
}> = ({ queries, results, done, active, animate }) => {
  const [open, setOpen] = useState(false);
  const t = useT();
  const count = useCountUp(queries.length, animate && !done);
  const sites = new Map<string, string>();
  for (const read of results) {
    if (read.url) sites.set(URL.parse(read.url)?.hostname ?? read.url, read.url);
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "text-muted-foreground hover:text-foreground flex h-6 min-w-0 items-center gap-2 text-start text-sm transition-colors",
          appear,
        )}
      >
        <IconSearch stroke={1.5} className="text-foreground/70 size-4 shrink-0" />
        <span className={cn("shrink-0 tabular-nums", active && "shimmer")}>
          {count === 1 ? t("Ran 1 search") : t("Ran {count} searches", { count })}
        </span>
        {done && results.length > 0 && (
          <span className="text-muted-foreground/70 ms-auto flex shrink-0 items-center gap-1.5 ps-3 tabular-nums">
            {results.length === 1 ? t("1 result") : t("{count} results", { count: results.length })}
            <span className="flex -space-x-1">
              {[...sites.values()].slice(0, 3).map((url) => (
                <Favicon key={url} url={url} size={14} />
              ))}
            </span>
          </span>
        )}
      </button>
      {open &&
        queries.map((query) => (
          <span
            key={query}
            className="text-muted-foreground flex h-6 min-w-0 items-center gap-2 ps-6 text-sm"
          >
            <IconSearch stroke={1.5} className="text-foreground/50 size-3.5 shrink-0" />
            <span className="min-w-0 truncate">{query}</span>
          </span>
        ))}
      {open &&
        results.map((read, i) => {
          const Icon = READ_ICONS[read.source];
          return (
            <a
              key={`${read.source}-${i}`}
              href={read.url}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground flex h-6 min-w-0 items-center gap-2 ps-6 text-sm font-normal! no-underline! transition-colors"
            >
              <Icon stroke={1.5} className="text-foreground/70 size-4 shrink-0" />
              <span className="min-w-0 truncate">{read.title}</span>
              {read.detail && (
                <span className="text-muted-foreground/70 shrink-0">· {read.detail}</span>
              )}
            </a>
          );
        })}
    </div>
  );
};

const StepRow: FC<{ step: ResearchStep; active: boolean; animate: boolean }> = ({
  step,
  active,
  animate,
}) => {
  const t = useT();
  switch (step.kind) {
    case "think":
      return (
        <Row key={step.text} Icon={IconBulb} active={active}>
          {step.text || t("Thinking")}
        </Row>
      );
    case "searches":
      return (
        <SearchesRow
          queries={step.queries}
          results={step.results}
          done={step.done}
          active={active}
          animate={animate}
        />
      );
    case "browse":
      return (
        <Row Icon={IconWorld} active={active} code={pageOf(step.url)} href={step.url}>
          {t("Browsed")}
        </Row>
      );
    case "verses":
      return (
        <Row Icon={IconBook} active={active} code={step.title} href={step.url}>
          {t("Read")}
        </Row>
      );
    case "tool": {
      const tool = TOOLS.get(step.tool);
      return (
        <Row Icon={tool?.Icon ?? IconSparkles} active={active}>
          {tool ? tool.label(t, step.detail) : step.tool}
        </Row>
      );
    }
    default: {
      const unknownStep: never = step;
      return unknownStep;
    }
  }
};
