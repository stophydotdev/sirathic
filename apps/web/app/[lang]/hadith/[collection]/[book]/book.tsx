"use client";

import { useLocalePath, useT } from "@/components/i18n";
import { ThreadShell } from "@/components/thread-shell";
import { api } from "@/lib/trpc";
import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { type FC, useState } from "react";

type Page = Awaited<ReturnType<typeof api.hadith.page.query>>;
type Hadith = Page["hadiths"][number];

const NARRATOR =
  /^(.{1,160}?(?:reported|narrated|said)(?: that)?:|Narrated [^:]{1,140}:)\s*/u;

const HadithRow: FC<{ hadith: Hadith; collection: string }> = ({
  hadith,
  collection,
}) => {
  const english = hadith.english ?? "";
  const [lead = "", narrator] = NARRATOR.exec(english) ?? [];
  const reference = `${collection} ${hadith.id.split(":")[1] ?? hadith.number}`;

  return (
    <article
      data-ask-ref={reference}
      className="border-border/50 flex flex-col gap-3.5 border-b py-5"
    >
      <span className="text-sm font-[470]">{reference}</span>
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-7">
        {english && (
          <p className="text-[15px] leading-relaxed">
            {narrator && (
              <span className="mb-1 block font-semibold">{narrator}</span>
            )}
            {english.slice(lead.length)}
          </p>
        )}
        {hadith.textAr && (
          <p dir="rtl" lang="ar" className="text-xl leading-loose">
            {hadith.textAr}
          </p>
        )}
      </div>
    </article>
  );
};

export const Book: FC<{
  collection: string;
  book: number;
  first: Page | undefined;
}> = ({ collection, book, first }) => {
  const [pages, setPages] = useState(first ? [first] : []);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(!first);
  const t = useT();
  const href = useLocalePath();

  const loadMore = () => {
    setLoading(true);
    api.hadith.page
      .query({ collection, book, page: pages.length })
      .then(
        (next) => setPages((loaded) => [...loaded, next]),
        () => setFailed(true),
      )
      .finally(() => setLoading(false));
  };

  const last = pages.at(-1);

  return (
    <main className="h-dvh">
      <ThreadShell>
        <div className="h-full overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-6 pt-3 pb-16">
            <Link
              href={href(`/hadith/${collection}`)}
              className="text-muted-foreground hover:text-foreground ms-10 flex h-8 w-fit items-center gap-1 text-sm lg:ms-0"
            >
              <ChevronLeftIcon className="size-4 rtl:rotate-180" />
              {first?.collection.nameEn ?? t("Books")}
            </Link>
            {first && (
              <>
                <div className="mt-4 flex items-baseline gap-3">
                  {book !== 0 && (
                    <span className="text-muted-foreground text-lg tabular-nums">
                      {book}
                    </span>
                  )}
                  <h1 className="text-xl font-medium tracking-tight">
                    {book === 0
                      ? t("Other hadith")
                      : (first.book.name ??
                        t("Book {number}", { number: book }))}
                  </h1>
                </div>
                <p className="text-muted-foreground mt-1 text-sm tabular-nums">
                  {t("{count} hadith", { count: first.book.hadiths })}
                  {book !== 0 &&
                    first.book.first !== null &&
                    first.book.last !== null &&
                    ` · ${t("{first} to {last}", {
                      first: first.book.first,
                      last: first.book.last,
                    })}`}
                </p>
              </>
            )}
            {failed && (
              <p className="text-muted-foreground mt-6 text-sm">
                {t("These hadith could not be loaded.")}
              </p>
            )}
            <div className="mt-2">
              {pages.flatMap((page) =>
                page.hadiths.map((hadith) => (
                  <HadithRow
                    key={hadith.id}
                    hadith={hadith}
                    collection={first?.collection.nameEn ?? collection}
                  />
                )),
              )}
            </div>
            {loading && (
              <p className="text-muted-foreground mt-6 text-sm">
                {t("Loading…")}
              </p>
            )}
            {!loading && last?.more && (
              <button
                type="button"
                onClick={loadMore}
                className="bg-card hover:bg-muted mt-6 h-10 w-full rounded-xl text-sm"
              >
                {t("Load more")}
              </button>
            )}
          </div>
        </div>
      </ThreadShell>
    </main>
  );
};
