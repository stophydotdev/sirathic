"use client";

import { useLocalePath, useT } from "@/components/i18n";
import type { MessageKey } from "@/messages/en";
import { type LastRead, readLastRead } from "@/components/quran/last-read";
import { ThreadShell } from "@/components/thread-shell";
import type { loadQuranIndex } from "@/lib/server-api";
import { cn } from "@/lib/utils";
import { BookmarkIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { type FC, useEffect, useState } from "react";

type Index = Awaited<ReturnType<typeof loadQuranIndex>>;

const simplify = (text: string) =>
  text.toLowerCase().replaceAll(/[^a-z0-9]/gu, "");

const TAB_NAMES = {
  surah: "Surah",
  juz: "Juz",
  page: "Page",
} satisfies Record<"surah" | "juz" | "page", MessageKey>;

export const Quran: FC<{ index: Index }> = ({ index }) => {
  const [tab, setTab] = useState<"surah" | "juz" | "page">("surah");
  const [query, setQuery] = useState("");
  const [last, setLast] = useState<LastRead>();
  const t = useT();
  const href = useLocalePath();

  useEffect(() => {
    setLast(readLastRead());
  }, []);

  const needle = simplify(query);
  const surahs =
    index?.surahs.filter(
      (surah) =>
        !needle ||
        String(surah.number) === needle ||
        simplify(surah.nameTranslit).includes(needle) ||
        simplify(surah.nameEn).includes(needle),
    ) ?? [];

  return (
    <main className="h-dvh">
      <ThreadShell>
        <div className="h-full overflow-y-auto">
          <div className="mx-auto w-full max-w-[720px] px-6 pt-3 pb-16">
            <h1 className="flex h-8 items-center ps-10 text-xl font-medium tracking-tight lg:ps-0">
              {t("Quran")}
            </h1>
            {last && (
              <Link
                href={href(`/quran/${last.surah}?ayah=${last.ayah}`)}
                className="bg-card hover:bg-muted mt-4 flex items-center gap-3 rounded-xl p-3 text-sm"
              >
                <BookmarkIcon className="text-super size-4" />
                <span className="flex-1">{t("Continue reading")}</span>
                <span className="text-muted-foreground">
                  {last.name} {last.surah}:{last.ayah}
                </span>
              </Link>
            )}
            <label className="bg-card mt-4 flex h-11 items-center gap-2 rounded-xl px-3">
              <SearchIcon className="text-muted-foreground size-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("Find a surah")}
                className="placeholder:text-muted-foreground flex-1 bg-transparent text-base outline-none"
              />
            </label>
            <div
              role="tablist"
              className="border-border/50 mt-4 flex gap-5 border-b"
            >
              {(["surah", "juz", "page"] as const).map((name) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={tab === name}
                  onClick={() => setTab(name)}
                  className={cn(
                    "-mb-px h-10 border-b-2 text-sm",
                    tab === name
                      ? "border-foreground"
                      : "text-muted-foreground border-transparent",
                  )}
                >
                  {t(TAB_NAMES[name])}
                </button>
              ))}
            </div>
            {!index && (
              <p className="text-muted-foreground mt-6 text-sm">
                {t("The Quran could not be loaded. Try again later.")}
              </p>
            )}
            {tab === "surah" && (
              <div className="mt-2 flex flex-col">
                {surahs.map((surah) => (
                  <Link
                    key={surah.number}
                    href={href(`/quran/${surah.number}`)}
                    className="hover:bg-muted -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5"
                  >
                    <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg text-sm tabular-nums">
                      {surah.number}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-[470]">
                        {surah.nameTranslit}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {surah.nameEn}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      <span lang="ar" className="text-lg leading-9">
                        {surah.nameAr}
                      </span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {t("{count} ayahs", { count: surah.verseCount })}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
            {tab === "juz" && (
              <div className="mt-2 flex flex-col">
                {index?.juzs.map((juz) => (
                  <Link
                    key={juz.juz}
                    href={href(`/quran/${juz.surah}?ayah=${juz.ayah}`)}
                    className="hover:bg-muted -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5"
                  >
                    <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg text-sm tabular-nums">
                      {juz.juz}
                    </span>
                    <span className="flex-1 font-[470]">
                      {t("Juz {number}", { number: juz.juz })}
                    </span>
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {t("Pages {first}–{last}", {
                        first: juz.firstPage,
                        last: juz.lastPage,
                      })}
                    </span>
                  </Link>
                ))}
              </div>
            )}
            {tab === "page" && (
              <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-2">
                {index?.pages.map((page) => (
                  <Link
                    key={page.page}
                    href={href(`/quran/${page.surah}?ayah=${page.ayah}`)}
                    className="bg-muted text-muted-foreground hover:text-foreground flex h-11 items-center justify-center rounded-lg text-sm tabular-nums"
                  >
                    {page.page}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </ThreadShell>
    </main>
  );
};
