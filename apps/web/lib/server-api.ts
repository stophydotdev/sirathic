import type { AppRouter } from "@sirathic/server/router";
import { createTRPCClient, httpLink } from "@trpc/client";
import { headers } from "next/headers";
import { cache } from "react";

const apiAsVisitor = cache(async () => {
  const cookie = (await headers()).get("cookie") ?? "";
  return createTRPCClient<AppRouter>({
    links: [
      httpLink({
        url: `${process.env.NEXT_PUBLIC_SERVER}/trpc`,
        headers: { cookie },
      }),
    ],
  });
});

export const loadQuranIndex = cache(async () =>
  (await apiAsVisitor()).quran.index.query().catch(() => undefined),
);

export const loadSurah = cache(async (number: number) =>
  (await apiAsVisitor()).quran.surah.query({ number }).catch(() => undefined),
);

export const loadTranslation = cache(
  async (translation: number, surah: number) =>
    (await apiAsVisitor()).quran.translation
      .query({ translation, surah })
      .catch(() => undefined),
);

export const loadCollections = cache(async () =>
  (await apiAsVisitor()).hadith.collections.query().catch(() => undefined),
);

export const loadBooks = cache(async (collection: string) =>
  (await apiAsVisitor()).hadith.books
    .query({ collection })
    .catch(() => undefined),
);

export const loadHadithPage = cache(async (collection: string, book: number) =>
  (await apiAsVisitor()).hadith.page
    .query({ collection, book })
    .catch(() => undefined),
);
