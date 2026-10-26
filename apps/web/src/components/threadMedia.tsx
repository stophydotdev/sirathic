"use client";

import { Favicon } from "@/components/favicon";
import { useT } from "@/components/i18n";
import type { PlainKey } from "@/components/locales";
import { turnsOf } from "@/components/sources";
import { api } from "@/lib/trpc";
import { useAuiState } from "@assistant-ui/react";
import Image from "next/image";
import { type FC, type ReactNode, useEffect, useState } from "react";

type Images = Awaited<ReturnType<typeof api.media.images.query>>;

type Load<T> = { status: "loading" } | { status: "failed" } | { status: "done"; value: T };

const imagesByQuestion = new Map<string, Promise<Images>>();

const searchImages = (q: string) => api.media.images.query({ q });

function useSearch<T>(
  cache: Map<string, Promise<T>>,
  search: (q: string) => Promise<T>,
  question: string,
) {
  const [load, setLoad] = useState<Load<T>>({ status: "loading" });

  useEffect(() => {
    let current = true;
    setLoad({ status: "loading" });
    let pending = cache.get(question);
    if (!pending) {
      pending = search(question);
      cache.set(question, pending);
      pending.catch(() => cache.delete(question));
    }
    pending.then(
      (value) => {
        if (current) setLoad({ status: "done", value });
      },
      () => {
        if (current) setLoad({ status: "failed" });
      },
    );
    return () => {
      current = false;
    };
  }, [cache, search, question]);

  return load;
}

const Turn: FC<{
  question: string;
  load: Load<unknown[]>;
  empty: PlainKey;
  children: ReactNode;
}> = ({ question, load, empty, children }) => {
  const t = useT();
  return (
    <section className="flex flex-col gap-2">
      <p className="text-muted-foreground px-1 text-sm">
        {t("Results for:")} <span className="text-foreground">{question}</span>
      </p>
      {load.status === "loading" && (
        <p className="text-muted-foreground px-1 text-sm">{t("Searching…")}</p>
      )}
      {load.status === "failed" && (
        <p className="text-muted-foreground px-1 text-sm">
          {t("The search failed. Try this tab again later.")}
        </p>
      )}
      {load.status === "done" &&
        (load.value.length === 0 ? (
          <p className="text-muted-foreground px-1 text-sm">{t(empty)}</p>
        ) : (
          children
        ))}
    </section>
  );
};

const TurnImages: FC<{ question: string }> = ({ question }) => {
  const load = useSearch(imagesByQuestion, searchImages, question);

  return (
    <Turn question={question} load={load} empty="No images">
      {load.status === "done" && (
        <div className="flex flex-wrap gap-4 [--row:85px] after:grow-[999] after:content-[''] sm:[--row:120px] lg:gap-x-6 lg:gap-y-5 lg:[--row:115px]">
          {load.value.map((image) => (
            <a
              key={image.imageUrl}
              href={image.pageUrl}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 flex-col gap-1.5"
              style={{
                flexGrow: image.width / image.height,
                flexBasis: `calc(${image.width / image.height} * var(--row))`,
              }}
            >
              <Image
                src={image.thumbnailUrl}
                alt={image.title ?? ""}
                width={image.width}
                height={image.height}
                unoptimized
                className="bg-muted h-[120px] w-full rounded-xl object-cover lg:h-40"
              />
              <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
                <Favicon url={image.pageUrl} size={16} />
                <span className="truncate">{image.source}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </Turn>
  );
};

const Turns: FC<{ Each: FC<{ question: string }> }> = ({ Each }) => {
  const turns = turnsOf(useAuiState((s) => s.thread.messages));

  return (
    <div className="mx-auto flex w-full max-w-[736px] flex-col gap-8 px-6 pt-6 pb-16 lg:max-w-5xl">
      {turns.map((turn) => (
        <Each key={turn.id} question={turn.question} />
      ))}
    </div>
  );
};

export const ThreadImages: FC = () => <Turns Each={TurnImages} />;
