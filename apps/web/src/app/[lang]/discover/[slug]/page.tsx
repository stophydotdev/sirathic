import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FollowUp, ShareLink } from "@/components/discoverActions";
import { ArticleBody } from "@/components/discoverArticle";
import { DiscoverCard } from "@/components/discoverCard";
import { ThreadShell } from "@/components/threadShell";
import { articleOf, articles } from "@/content/discover/articles";
import { alternatesOf, SITE } from "@/lib/seo";
import { translator } from "../../dictionaries";

const DESCRIPTION_CHARS = 160;

export function generateStaticParams() {
  return articles.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/discover/[slug]">): Promise<Metadata> {
  const article = articleOf((await params).slug);
  if (!article) return {};
  const description =
    article.summary.text.length <= DESCRIPTION_CHARS
      ? article.summary.text
      : `${article.summary.text.slice(0, DESCRIPTION_CHARS).replace(/\s+\S*$/u, "")}…`;
  return {
    title: article.title,
    description,
    alternates: alternatesOf(`/discover/${article.slug}`),
    openGraph: {
      title: article.title,
      description,
      type: "article",
      modifiedTime: article.updated,
      images: [{ url: `${SITE}/discover/${article.slug}/image`, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title: article.title, description },
  };
}

export default async function DiscoverArticlePage({
  params,
}: PageProps<"/[lang]/discover/[slug]">) {
  const { lang, slug } = await params;
  const { t } = await translator(lang);
  const article = articleOf(slug);
  if (!article) notFound();
  const related = article.related.flatMap((relatedSlug) => articleOf(relatedSlug) ?? []);
  const url = `${SITE}/discover/${article.slug}`;
  const structured = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.summary.text,
    datePublished: article.updated,
    dateModified: article.updated,
    inLanguage: "en",
    mainEntityOfPage: url,
    image: `${url}/image`,
    author: { "@type": "Organization", name: "Sirathic", url: SITE },
    publisher: { "@type": "Organization", name: "Sirathic", url: SITE, logo: `${SITE}/icon.svg` },
    citation: article.sources.map((source) => ({
      "@type": "CreativeWork",
      name: source.title,
      url: source.url,
    })),
  }).replaceAll("<", "\\u003c");

  return (
    <main className="h-dvh">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structured }} />
      <ThreadShell>
        <div className="h-full overflow-y-auto">
          <header className="bg-background border-border sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b ps-14 pe-4 lg:ps-4">
            <Link
              href="/discover"
              className="bg-foreground/10 hover:bg-foreground/15 flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-[470] transition-colors"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4 rtl:rotate-180" />
              {t("Back to Discover")}
            </Link>
            <ShareLink />
          </header>
          <div className="mx-auto flex w-full max-w-180 flex-col gap-12 px-4 pt-9 pb-16">
            <ArticleBody article={article} />
            {related.length > 0 && (
              <section className="flex flex-col gap-4">
                <h2 className="text-lg font-medium">{t("Discover more")}</h2>
                <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2">
                  {related.map((found) => (
                    <DiscoverCard key={found.slug} article={found} />
                  ))}
                </div>
              </section>
            )}
          </div>
          <FollowUp title={article.title} />
        </div>
      </ThreadShell>
    </main>
  );
}
