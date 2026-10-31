import type { Metadata } from "next";
import { DiscoverCard } from "@/components/discoverCard";
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
  };
}

export default async function DiscoverPage({ params }: PageProps<"/[lang]/discover">) {
  const { t } = await translator((await params).lang);
  const [lead, ...rest] = articles;

  return (
    <main className="h-dvh">
      <ThreadShell>
        <div className="h-full overflow-y-auto">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 pt-16 pb-16 lg:pt-10">
            <header className="flex flex-col gap-1">
              <h1 className="text-2xl font-[580]">{t("Discover")}</h1>
              <p className="text-muted-foreground text-sm">
                {t(
                  "Disputed questions, answered from the Quran, hadith and fiqh books with every source cited.",
                )}
              </p>
            </header>
            {lead && <DiscoverCard article={lead} lead />}
            <div
              className={cn(
                "grid gap-x-6 gap-y-10 sm:grid-cols-2",
                rest.length > 2 && "lg:grid-cols-3",
              )}
            >
              {rest.map((article) => (
                <DiscoverCard key={article.slug} article={article} />
              ))}
            </div>
          </div>
        </div>
      </ThreadShell>
    </main>
  );
}
