"use client";

import { DraftBadge, useDateOf, useSourceCount } from "@/components/discoverArticle";
import { useT } from "@/components/i18n";
import type { Article } from "@/content/discover/schema";
import { MixedText } from "@/components/discoverText";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { FC } from "react";

export const DiscoverCard: FC<{ article: Article; lead?: boolean }> = ({
  article,
  lead = false,
}) => {
  const t = useT();
  const dateOf = useDateOf();
  const sourceCount = useSourceCount();
  return (
    <Link
      href={`/discover/${article.slug}`}
      className={cn("group flex flex-col gap-4", lead && "lg:grid lg:grid-cols-5 lg:gap-8")}
    >
      <div
        className={cn(
          "bg-muted group-hover:bg-foreground/10 flex items-center justify-center rounded-2xl px-6 text-center transition-colors",
          lead ? "min-h-40 lg:order-2 lg:col-span-2" : "h-36",
        )}
      >
        {article.verse ? (
          <span dir="rtl" lang="ar" className="font-quran text-2xl leading-loose sm:text-3xl">
            {article.verse.arabic}
          </span>
        ) : (
          <span className="text-muted-foreground font-serif text-2xl">{article.topic}</span>
        )}
      </div>
      <div className={cn("flex flex-col gap-2", lead && "lg:col-span-3 lg:justify-center")}>
        <h2
          className={cn(
            "font-serif leading-snug text-balance",
            lead ? "text-3xl sm:text-4xl" : "text-xl",
          )}
        >
          {article.title}
        </h2>
        <p
          className={cn(
            "text-muted-foreground font-serif",
            lead ? "line-clamp-4 text-lg leading-7" : "line-clamp-2 text-base leading-6",
          )}
        >
          <MixedText text={article.summary.text} />
        </p>
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span>{article.topic}</span>
          <span aria-hidden>·</span>
          <span>{sourceCount(article.sources.length)}</span>
          <span aria-hidden>·</span>
          <span>{t("Updated {date}", { date: dateOf(article.updated) })}</span>
          {!article.reviewed && <DraftBadge />}
        </p>
      </div>
    </Link>
  );
};
