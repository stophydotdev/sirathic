"use client";

import { Claim } from "@/components/discoverText";
import { Favicon } from "@/components/favicon";
import { Mark } from "@/components/logo";
import { siteName } from "@/components/sources";
import { useLocale, useT } from "@/components/i18n";
import type { Article } from "@/content/discover/schema";
import { cn } from "@/lib/utils";
import type { FC } from "react";

const CARD_COUNT = 4;

export const TINTS = {
  teal: {
    cover: "from-teal-950 via-teal-900 to-cyan-800",
    label: "text-teal-700 dark:text-teal-300",
  },
  rose: {
    cover: "from-rose-950 via-rose-900 to-red-800",
    label: "text-rose-700 dark:text-rose-300",
  },
  amber: {
    cover: "from-amber-950 via-amber-900 to-orange-800",
    label: "text-amber-700 dark:text-amber-300",
  },
  indigo: {
    cover: "from-indigo-950 via-indigo-900 to-blue-800",
    label: "text-indigo-700 dark:text-indigo-300",
  },
} satisfies Record<Article["tint"], { cover: string; label: string }>;
const STACK_COUNT = 3;

export function useDateOf() {
  const locale = useLocale();
  return (updated: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
      new Date(updated),
    );
}

export function useSourceCount() {
  const t = useT();
  return (count: number) => (count === 1 ? t("1 source") : t("{count} sources", { count }));
}

export const DraftBadge: FC = () => {
  const t = useT();
  return (
    <span className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-xs">
      {t("Checked against its sources")}
    </span>
  );
};

export const SourceStack: FC<{ sources: Article["sources"] }> = ({ sources }) => (
  <span className="flex">
    {sources
      .filter(
        (source, index) =>
          sources.findIndex((other) => siteName(other.url) === siteName(source.url)) === index,
      )
      .slice(0, STACK_COUNT)
      .map((source) => (
        <Favicon
          key={source.url}
          url={source.url}
          size={14}
          className="border-background -me-1.5 border"
        />
      ))}
  </span>
);

const SourceCards: FC<{ sources: Article["sources"] }> = ({ sources }) => (
  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
    {sources.slice(0, CARD_COUNT).map((source) => (
      <a
        key={source.url}
        href={source.url}
        target="_blank"
        rel="noreferrer"
        className="bg-muted hover:bg-foreground/10 flex min-w-0 flex-col gap-1 rounded-xl px-3 py-2.5 transition-colors"
      >
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Favicon url={source.url} size={12} />
          <span className="truncate">{siteName(source.url)}</span>
        </span>
        <span className="line-clamp-2 text-sm leading-snug font-medium">{source.title}</span>
      </a>
    ))}
  </div>
);

const VerseBlock: FC<{ verse: NonNullable<Article["verse"]>; tint: Article["tint"] }> = ({
  verse,
  tint,
}) => (
  <figure
    className={cn(
      "star-pattern flex flex-col items-center gap-3 overflow-hidden rounded-2xl bg-linear-to-br px-6 py-10 text-center text-white",
      TINTS[tint].cover,
    )}
  >
    <p dir="rtl" lang="ar" className="font-quran text-3xl leading-loose sm:text-4xl">
      {verse.arabic}
    </p>
    <figcaption className="font-serif text-lg text-white/75">
      {verse.translation}{" "}
      <a href={verse.url} target="_blank" rel="noreferrer" className="hover:text-white">
        {verse.reference}
      </a>
    </figcaption>
  </figure>
);

const Section: FC<{ section: Article["sections"][number]; sources: Article["sources"] }> = ({
  section,
  sources,
}) => {
  const sourceCount = useSourceCount();
  const cited = sources.filter((source) =>
    section.paragraphs.some((paragraph) => paragraph.citations.includes(source.url)),
  );
  return (
    <section className="flex flex-col gap-3.5 pt-2">
      <h2 className="font-serif text-2xl leading-snug text-balance">{section.heading}</h2>
      {section.paragraphs.map((paragraph) => (
        <div key={paragraph.text} className="font-serif text-lg leading-7 sm:text-xl sm:leading-8">
          <Claim paragraph={paragraph} />
        </div>
      ))}
      <details className="group self-start">
        <summary className="text-muted-foreground hover:text-foreground border-border flex cursor-pointer list-none items-center gap-2 rounded-full border py-1.5 ps-2 pe-3 text-sm select-none">
          <SourceStack sources={cited} />
          {sourceCount(cited.length)}
        </summary>
        <ol className="mt-3 flex flex-col gap-3">
          {cited.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="group/source flex min-w-0 flex-col"
              >
                <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Favicon url={source.url} size={12} />
                  {siteName(source.url)}
                </span>
                <span className="text-foreground/85 group-hover/source:text-foreground text-sm">
                  {source.title}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
};

export const ArticleBody: FC<{ article: Article }> = ({ article }) => {
  const t = useT();
  const dateOf = useDateOf();
  return (
    <article data-ask-ref={article.title} className="flex flex-col gap-5">
      <h1 className="font-serif text-3xl leading-tight text-balance sm:text-4xl">
        {article.title}
      </h1>
      <div className="font-serif text-lg leading-7 sm:text-xl sm:leading-8">
        <Claim paragraph={article.summary} />
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm">
        <span className="text-foreground flex items-center gap-2">
          <Mark size={18} color="currentColor" />
          Sirathic
          {!article.reviewed && <DraftBadge />}
        </span>
        <span>{t("Updated {date}", { date: dateOf(article.updated) })}</span>
      </div>
      <SourceCards sources={article.sources} />
      {article.verse && <VerseBlock verse={article.verse} tint={article.tint} />}
      {article.sections.map((section) => (
        <Section key={section.heading} section={section} sources={article.sources} />
      ))}
    </article>
  );
};
