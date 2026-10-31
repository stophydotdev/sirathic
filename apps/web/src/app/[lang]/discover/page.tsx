import type { Metadata } from "next";
import { Fragment } from "react";
import { z } from "zod";
import { DiscoverTabs, ShareLink } from "@/components/discoverActions";
import { DiscoverCard } from "@/components/discoverCard";
import { DiscoverRail } from "@/components/discoverRail";
import { ThreadShell } from "@/components/threadShell";
import { articles } from "@/content/discover/articles";
import { alternatesOf } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { translator } from "../dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/discover">): Promise<Metadata> {
  const { t } = await translator((await params).lang);
  const description = t(
    "Disputed questions, answered from the Quran, hadith and fiqh books with every source cited.",
  );
  return {
    title: t("Discover"),
    description,
    alternates: alternatesOf("/discover"),
    openGraph: { title: t("Discover"), description, type: "website" },
    twitter: { card: "summary_large_image", title: t("Discover"), description },
  };
}

const CARDS = 3;
const TOPICS = [...new Set(articles.map((found) => found.topic))];

export default async function DiscoverPage({
  params,
  searchParams,
}: PageProps<"/[lang]/discover">) {
  const { t } = await translator((await params).lang);
  const asked = z
    .string()
    .optional()
    .catch(undefined)
    .parse((await searchParams).topic);
  const topic = TOPICS.find((name) => name.toLowerCase() === asked?.toLowerCase());
  const [lead, ...rest] = topic ? articles.filter((found) => found.topic === topic) : articles;
  const groups = Array.from({ length: Math.ceil(rest.length / (CARDS + 1)) }, (_, at) =>
    rest.slice(at * (CARDS + 1), (at + 1) * (CARDS + 1)),
  );

  return (
    <main className="h-dvh">
      <ThreadShell>
        <div className="h-full overflow-y-auto">
          <header className="bg-background border-border sticky top-0 z-20 flex h-14 items-center gap-3 border-b ps-14 pe-4 lg:ps-4">
            <h1 className="flex-1 text-sm font-medium">{t("Discover")}</h1>
            <DiscoverTabs topics={TOPICS} chosen={topic} />
            <div className="flex flex-1 justify-end">
              <ShareLink />
            </div>
          </header>
          <div className="mx-auto flex w-full max-w-6xl gap-8 px-6 pt-8 pb-16">
            <div className="flex min-w-0 flex-1 flex-col gap-10">
              {lead && <DiscoverCard article={lead} kind="lead" />}
              {groups.map((group) => {
                const cards = group.slice(0, CARDS);
                const [wide] = group.slice(CARDS);
                return (
                  <Fragment key={group[0]?.slug}>
                    <div
                      className={cn(
                        "grid gap-4 sm:grid-cols-2",
                        cards.length === CARDS && "lg:grid-cols-3",
                      )}
                    >
                      {cards.map((article) => (
                        <DiscoverCard key={article.slug} article={article} />
                      ))}
                    </div>
                    {wide && <DiscoverCard article={wide} kind="wide" />}
                  </Fragment>
                );
              })}
            </div>
            <DiscoverRail />
          </div>
        </div>
      </ThreadShell>
    </main>
  );
}
