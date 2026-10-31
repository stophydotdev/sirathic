"use client";

import {
  DraftBadge,
  SourceStack,
  TINTS,
  useDateOf,
  useSourceCount,
} from "@/components/discoverArticle";
import { useT } from "@/components/i18n";
import type { Article } from "@/content/discover/schema";
import { MixedText } from "@/components/discoverText";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { FC } from "react";

const Cover: FC<{ article: Article; lead: boolean; className: string }> = ({
  article,
  lead,
  className,
}) => (
  <div
    className={cn(
      "star-pattern flex items-center justify-center overflow-hidden bg-linear-to-br px-6 text-center text-white transition group-hover:brightness-110",
      TINTS[article.tint].cover,
      className,
    )}
  >
    {article.verse ? (
      <span
        dir="rtl"
        lang="ar"
        className={cn("font-quran text-2xl leading-loose", lead && "sm:text-3xl")}
      >
        {article.verse.arabic}
      </span>
    ) : (
      <span className="font-serif text-2xl text-white/80">{article.topic}</span>
    )}
  </div>
);

const Topic: FC<{ article: Article }> = ({ article }) => (
  <span className={cn("text-xs font-medium", TINTS[article.tint].label)}>{article.topic}</span>
);

const Sources: FC<{ article: Article }> = ({ article }) => {
  const sourceCount = useSourceCount();
  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="flex items-center gap-2.5">
        <SourceStack sources={article.sources} />
        {sourceCount(article.sources.length)}
      </span>
      {!article.reviewed && <DraftBadge />}
    </p>
  );
};

export const DiscoverCard: FC<{ article: Article; lead?: boolean }> = ({
  article,
  lead = false,
}) => {
  const t = useT();
  const dateOf = useDateOf();
  if (lead) {
    return (
      <Link
        href={`/discover/${article.slug}`}
        className="group flex flex-col gap-4 lg:grid lg:grid-cols-5 lg:gap-8"
      >
        <Cover
          article={article}
          lead
          className="min-h-40 rounded-2xl lg:order-2 lg:col-span-2 lg:min-h-56"
        />
        <div className="flex flex-col gap-3 lg:col-span-3 lg:justify-center">
          <Topic article={article} />
          <h2 className="font-serif text-3xl leading-snug text-balance sm:text-4xl">
            {article.title}
          </h2>
          <p className="text-muted-foreground text-xs">
            {t("Updated {date}", { date: dateOf(article.updated) })}
          </p>
          <p className="font-serif line-clamp-4 text-lg leading-7">
            <MixedText text={article.summary.text} />
          </p>
          <Sources article={article} />
        </div>
      </Link>
    );
  }
  return (
    <Link
      href={`/discover/${article.slug}`}
      className="group border-border flex flex-col overflow-hidden rounded-2xl border"
    >
      <Cover article={article} lead={false} className="h-36" />
      <div className="flex flex-1 flex-col justify-between gap-4 p-4">
        <div className="flex flex-col gap-1.5">
          <Topic article={article} />
          <h2 className="font-serif text-xl leading-snug text-balance">{article.title}</h2>
        </div>
        <Sources article={article} />
      </div>
    </Link>
  );
};
