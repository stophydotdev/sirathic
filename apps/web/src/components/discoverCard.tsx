"use client";

import { CardMenu } from "@/components/discoverActions";
import { SourceStack, TINTS, useDateOf, useSourceCount } from "@/components/discoverArticle";
import { useLocale, useT } from "@/components/i18n";
import type { Article } from "@/content/discover/schema";
import { MixedText } from "@/components/discoverText";
import { cn } from "@/lib/utils";
import { Clock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { type FC, useSyncExternalStore } from "react";

type Kind = "lead" | "card" | "wide";

const DAY_MS = 86_400_000;

const subscribeNever = () => () => {};

const Cover: FC<{ article: Article; big: boolean; className: string }> = ({
  article,
  big,
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
        className={cn("font-quran text-2xl leading-loose", big && "sm:text-3xl")}
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

const Published: FC<{ updated: string }> = ({ updated }) => {
  const t = useT();
  const locale = useLocale();
  const dateOf = useDateOf();
  const days = useSyncExternalStore(
    subscribeNever,
    () => Math.max(0, Math.floor((Date.now() - Date.parse(updated)) / DAY_MS)),
    () => undefined,
  );
  const when =
    days === undefined
      ? dateOf(updated)
      : new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-days, "day");
  return (
    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
      {t("Published {when}", { when })}
    </p>
  );
};

const Footer: FC<{ article: Article }> = ({ article }) => {
  const sourceCount = useSourceCount();
  return (
    <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
      <span className="flex items-center gap-2.5">
        <SourceStack sources={article.sources} />
        {sourceCount(article.sources.length)}
      </span>
      <CardMenu title={article.title} slug={article.slug} />
    </div>
  );
};

export const DiscoverCard: FC<{ article: Article; kind?: Kind }> = ({ article, kind = "card" }) => {
  const href = `/discover/${article.slug}`;
  if (kind === "card") {
    return (
      <article className="border-border flex flex-col overflow-hidden rounded-2xl border">
        <Link href={href} className="group flex flex-1 flex-col">
          <Cover article={article} big={false} className="h-36" />
          <div className="flex flex-col gap-1.5 px-4 pt-4">
            <Topic article={article} />
            <h2 className="font-serif text-xl leading-snug text-balance">{article.title}</h2>
          </div>
        </Link>
        <div className="px-4 pt-2 pb-3">
          <Footer article={article} />
        </div>
      </article>
    );
  }
  const lead = kind === "lead";
  return (
    <article
      className={cn(
        "flex flex-col gap-4 lg:grid lg:grid-cols-5 lg:gap-8",
        !lead && "lg:items-center",
      )}
    >
      <Link href={href} className={cn("group lg:col-span-2", lead && "lg:order-2")}>
        <Cover
          article={article}
          big={lead}
          className={cn("rounded-2xl", lead ? "h-full min-h-40 lg:min-h-56" : "h-40 lg:h-44")}
        />
      </Link>
      <div className="flex flex-col gap-3 lg:col-span-3 lg:justify-center">
        <Topic article={article} />
        <Link href={href}>
          <h2
            className={cn(
              "font-serif leading-snug text-balance",
              lead ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl",
            )}
          >
            {article.title}
          </h2>
        </Link>
        <Published updated={article.updated} />
        <p className={cn("font-serif text-lg leading-7", lead ? "line-clamp-4" : "line-clamp-3")}>
          <MixedText text={article.summary.text} />
        </p>
        <Footer article={article} />
      </div>
    </article>
  );
};
