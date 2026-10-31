import type { Metadata } from "next";
import { ShareLink } from "@/components/discoverActions";
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

export default async function DiscoverPage({ params }: PageProps<"/[lang]/discover">) {
  const { t } = await translator((await params).lang);
  const [lead, ...rest] = articles;

  return (
    <main className="h-dvh">
      <ThreadShell>
        <div className="h-full overflow-y-auto">
          <header className="bg-background border-border sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b ps-14 pe-4 lg:ps-4">
            <h1 className="text-sm font-medium">{t("Discover")}</h1>
            <ShareLink />
          </header>
          <div className="mx-auto flex w-full max-w-6xl gap-8 px-6 pt-8 pb-16">
            <div className="flex min-w-0 flex-1 flex-col gap-10">
              {lead && <DiscoverCard article={lead} lead />}
              <div className={cn("grid gap-4 sm:grid-cols-2", rest.length > 2 && "lg:grid-cols-3")}>
                {rest.map((article) => (
                  <DiscoverCard key={article.slug} article={article} />
                ))}
              </div>
            </div>
            <DiscoverRail />
          </div>
        </div>
      </ThreadShell>
    </main>
  );
}
