"use client";

import { Favicon } from "@/components/favicon";
import { useT } from "@/components/i18n";
import type { PlainKey } from "@/components/locales";
import { turnsOf } from "@/components/sources";
import { api } from "@/lib/trpc";
import { useAuiState } from "@assistant-ui/react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { type FC, Fragment, type ReactNode, useEffect, useState } from "react";

type Images = Awaited<ReturnType<typeof api.media.images.query>>;

type Load = { status: "loading" } | { status: "failed" } | { status: "done"; value: Images };

const FIRST_QUERIES = 3;

const FIRST_IMAGES = 20;

const imagesByQuery = new Map<string, Promise<Images>>();

function searchImages(query: string) {
  let pending = imagesByQuery.get(query);
  if (!pending) {
    pending = api.media.images.query({ q: query });
    imagesByQuery.set(query, pending);
    pending.catch(() => imagesByQuery.delete(query));
  }
  return pending;
}

async function imagesFor(queries: readonly string[]) {
  const found = await Promise.allSettled(queries.map(searchImages));
  if (found.length > 0 && found.every((result) => result.status === "rejected")) {
    throw new Error("Every image search failed");
  }
  const images = found.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  return [...new Map(images.map((image) => [image.imageUrl, image])).values()];
}

function useImages(queries: readonly string[]) {
  const key = queries.join("\n");
  const [load, setLoad] = useState<Load>({ status: "loading" });

  useEffect(() => {
    let current = true;
    setLoad({ status: "loading" });
    imagesFor(key ? key.split("\n") : []).then(
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
  }, [key]);

  return load;
}

export const Searched: FC<{ queries: readonly string[]; className?: string }> = ({
  queries,
  className,
}) => {
  const t = useT();
  const [all, setAll] = useState(false);
  if (queries.length === 0) return null;
  const hidden = all ? 0 : queries.length - FIRST_QUERIES;

  return (
    <p className={cn("text-muted-foreground text-sm", className)}>
      {t("Searched:")}{" "}
      {(all ? queries : queries.slice(0, FIRST_QUERIES)).map((query, i) => (
        <Fragment key={query}>
          {i > 0 && " · "}
          <bdi className="text-foreground">{query}</bdi>
        </Fragment>
      ))}
      {hidden > 0 && (
        <>
          {" · "}
          <button type="button" onClick={() => setAll(true)} className="hover:text-foreground">
            {t("+{count} more", { count: hidden })}
          </button>
        </>
      )}
    </p>
  );
};

const Turn: FC<{
  queries: readonly string[];
  load: Load;
  empty: PlainKey;
  children: ReactNode;
}> = ({ queries, load, empty, children }) => {
  const t = useT();
  return (
    <section className="flex flex-col gap-2">
      <Searched queries={queries} className="px-1" />
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

const TurnImages: FC<{ queries: readonly string[] }> = ({ queries }) => {
  const load = useImages(queries);
  const [all, setAll] = useState(false);
  const t = useT();

  return (
    <Turn queries={queries} load={load} empty="No images">
      {load.status === "done" && (
        <>
          <div className="flex flex-wrap gap-4 [--row:85px] after:grow-[999] after:content-[''] sm:[--row:120px] lg:gap-x-6 lg:gap-y-5 lg:[--row:115px]">
            {(all ? load.value : load.value.slice(0, FIRST_IMAGES)).map((image) => (
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
          {!all && load.value.length > FIRST_IMAGES && (
            <button
              type="button"
              onClick={() => setAll(true)}
              className="bg-foreground/[0.06] hover:bg-foreground/10 h-8 self-center rounded-lg px-3.5 text-sm font-[470] transition-colors"
            >
              {t("View more")}
            </button>
          )}
        </>
      )}
    </Turn>
  );
};

export const ThreadImages: FC = () => {
  const turns = turnsOf(useAuiState((s) => s.thread.messages));

  return (
    <div className="mx-auto flex w-full max-w-[736px] flex-col gap-8 px-6 pt-6 pb-16 lg:max-w-5xl">
      {turns.map((turn) => (
        <TurnImages key={turn.id} queries={turn.queries} />
      ))}
    </div>
  );
};
