"use client";

import { useLocalePath, useT } from "@/components/i18n";
import { ThreadShell } from "@/components/thread-shell";
import type { loadBooks } from "@/lib/server-api";
import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import type { FC } from "react";

type Books = Awaited<ReturnType<typeof loadBooks>>;

export const Collection: FC<{ collection: string; data: Books }> = ({
  collection,
  data,
}) => {
  const t = useT();
  const href = useLocalePath();

  const books = (data?.books ?? []).toSorted(
    (a, b) => Number(a.number === 0) - Number(b.number === 0),
  );

  return (
    <main className="h-dvh">
      <ThreadShell>
        <div className="h-full overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-6 pt-3 pb-16">
            <Link
              href={href("/hadith")}
              className="text-muted-foreground hover:text-foreground ms-10 flex h-8 w-fit items-center gap-1 text-sm lg:ms-0"
            >
              <ChevronLeftIcon className="size-4 rtl:rotate-180" />
              {t("Hadith")}
            </Link>
            {!data && (
              <p className="text-muted-foreground mt-6 text-sm">
                {t("This collection could not be loaded.")}
              </p>
            )}
            {data && (
              <>
                <div className="mt-4 flex items-baseline gap-3">
                  <h1 className="text-xl font-medium tracking-tight">
                    {data.collection.nameEn}
                  </h1>
                  <span lang="ar" className="text-xl">
                    {data.collection.nameAr}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-sm tabular-nums">
                  {t("{count} hadith in {books} books", {
                    count: data.collection.hadiths.toLocaleString(),
                    books: data.books.length,
                  })}
                </p>
                <div className="mt-4 flex flex-col">
                  {books.map((book) => (
                    <Link
                      key={book.number}
                      href={href(`/hadith/${collection}/${book.number}`)}
                      className="odd:bg-muted hover:bg-foreground/10 grid grid-cols-[2.2em_1fr_auto] items-center gap-3 rounded-md px-3 py-2.5 text-[15px]"
                    >
                      <span className="text-muted-foreground tabular-nums">
                        {book.number === 0 ? "–" : book.number}
                      </span>
                      <span className="truncate">
                        {book.number === 0
                          ? t("Other hadith")
                          : (book.name ??
                            t("Book {number}", { number: book.number }))}
                      </span>
                      <span className="text-muted-foreground text-sm tabular-nums">
                        {book.number !== 0 &&
                        book.first !== null &&
                        book.last !== null
                          ? t("{first} to {last}", {
                              first: book.first,
                              last: book.last,
                            })
                          : t("{count} hadith", { count: book.hadiths })}
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </ThreadShell>
    </main>
  );
};
