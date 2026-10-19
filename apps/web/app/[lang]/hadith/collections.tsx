"use client";

import { useLocalePath, useT } from "@/components/i18n";
import { ThreadShell } from "@/components/thread-shell";
import type { loadCollections } from "@/lib/server-api";
import Link from "next/link";
import type { FC } from "react";

type Collections = Awaited<ReturnType<typeof loadCollections>>;

export const Hadith: FC<{ collections: Collections }> = ({ collections }) => {
  const t = useT();
  const href = useLocalePath();

  return (
    <main className="h-dvh">
      <ThreadShell>
        <div className="h-full overflow-y-auto">
          <div className="mx-auto w-full max-w-[720px] px-6 pt-3 pb-16">
            <h1 className="flex h-8 items-center ps-10 text-xl font-medium tracking-tight lg:ps-0">
              {t("Hadith")}
            </h1>
            {!collections && (
              <p className="text-muted-foreground mt-6 text-sm">
                {t("The collections could not be loaded. Try again later.")}
              </p>
            )}
            <div className="mt-4 flex flex-col">
              {collections?.map((collection) => (
                <Link
                  key={collection.id}
                  href={href(`/hadith/${collection.id}`)}
                  className="hover:bg-muted -mx-2 flex items-center gap-3 rounded-xl px-2 py-3"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-[470]">
                      {collection.nameEn}
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {t("{count} hadith", {
                        count: collection.hadiths.toLocaleString(),
                      })}
                    </span>
                  </span>
                  <span lang="ar" className="shrink-0 text-lg">
                    {collection.nameAr}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </ThreadShell>
    </main>
  );
};
