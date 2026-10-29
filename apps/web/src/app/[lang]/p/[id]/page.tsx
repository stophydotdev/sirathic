import type { AppRouter } from "@sirathic/server/router";
import { createTRPCClient, httpLink } from "@trpc/client";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Logo } from "@/components/logo";
import { PublishedAnswers } from "@/components/publishedPage";
import { translator } from "../../dictionaries";

const DESCRIPTION_CHARS = 160;

const server = createTRPCClient<AppRouter>({
  links: [httpLink({ url: `${process.env.NEXT_PUBLIC_SERVER}/trpc` })],
});

const pageOf = cache((id: string) => server.pages.get.query({ id }).catch(() => undefined));

const plain = (markdown: string) =>
  markdown
    .replaceAll(/\[\d+\]\([^)\s]*\)/gu, "")
    .replaceAll(/[#*_`>|]/gu, "")
    .replaceAll(/\s+/gu, " ")
    .trim();

export async function generateMetadata({ params }: PageProps<"/[lang]/p/[id]">): Promise<Metadata> {
  const page = await pageOf((await params).id);
  const [first] = page?.turns ?? [];
  if (!first) return {};
  const description = plain(first.answer).slice(0, DESCRIPTION_CHARS);
  return {
    title: first.question,
    description,
    openGraph: { title: first.question, description, type: "article" },
  };
}

export default async function PublishedPage({ params }: PageProps<"/[lang]/p/[id]">) {
  const { lang, id } = await params;
  const { t, locale } = await translator(lang);
  const page = await pageOf(id);
  const [first] = page?.turns ?? [];
  if (!page || !first) notFound();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(page.publishedAt),
  );

  return (
    <main className="min-h-dvh">
      <header className="border-border/60 flex items-center justify-between border-b px-5 py-3.5 md:px-10">
        <Link href="/" className="text-foreground">
          <Logo height={20} />
        </Link>
      </header>
      <article className="mx-auto w-full max-w-182 px-5 pt-12 pb-20">
        <h1 className="text-foreground text-3xl font-medium tracking-tight">{first.question}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {t("Answered by Sirathic · {date}", { date })}
        </p>
        <PublishedAnswers turns={page.turns} sources={page.sources} />
        <div className="mt-12 flex justify-center">
          <Link
            href="/"
            className="bg-primary text-primary-foreground h-10 rounded-full px-5 text-sm leading-10 font-[470] transition hover:opacity-85"
          >
            {t("Ask your own question")}
          </Link>
        </div>
      </article>
    </main>
  );
}
