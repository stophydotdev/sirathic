"use client";

import { type Translate, useT } from "@/components/i18n";
import type { PlainKey } from "@/components/locales";
import { turnsOf } from "@/components/sources";
import { api } from "@/lib/trpc";
import { useAuiState } from "@assistant-ui/react";
import Image from "next/image";
import { type FC, type ReactNode, useEffect, useState } from "react";

type Images = Awaited<ReturnType<typeof api.media.images.query>>;
type Videos = Awaited<ReturnType<typeof api.media.videos.query>>;

type Load<T> = { status: "loading" } | { status: "failed" } | { status: "done"; value: T };

const imagesByQuestion = new Map<string, Promise<Images>>();
const videosByQuestion = new Map<string, Promise<Videos>>();

const searchImages = (q: string) => api.media.images.query({ q });
const searchVideos = (q: string) => api.media.videos.query({ q });

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

const duration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};

const views = (count: number, t: Translate) =>
  t("{count} views", {
    count: new Intl.NumberFormat(undefined, { notation: "compact" }).format(count),
  });

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
        <div className="grid grid-cols-2 gap-2">
          {load.value.map((image) => (
            <a
              key={image.imageUrl}
              href={image.pageUrl}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 flex-col gap-1"
            >
              <span className="bg-muted relative aspect-[4/3] overflow-hidden rounded-lg">
                <Image
                  src={image.thumbnailUrl}
                  alt={image.title ?? ""}
                  fill
                  unoptimized
                  sizes="50vw"
                  className="object-cover"
                />
              </span>
              <span className="text-muted-foreground truncate px-0.5 text-xs">{image.source}</span>
            </a>
          ))}
        </div>
      )}
    </Turn>
  );
};

const TurnVideos: FC<{ question: string }> = ({ question }) => {
  const load = useSearch(videosByQuestion, searchVideos, question);
  const t = useT();

  return (
    <Turn question={question} load={load} empty="No videos">
      {load.status === "done" && (
        <div className="flex flex-col gap-1">
          {load.value.map((video) => (
            <a
              key={video.videoId}
              href={video.url}
              target="_blank"
              rel="noreferrer"
              className="hover:bg-muted flex gap-3 rounded-xl p-1.5"
            >
              <span className="bg-muted relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg">
                <Image
                  src={`https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`}
                  alt=""
                  fill
                  unoptimized
                  sizes="144px"
                  className="object-cover"
                />
                {video.durationSeconds !== null && (
                  <span className="absolute end-1 bottom-1 rounded bg-black/75 px-1 text-[11px] text-white tabular-nums">
                    {duration(video.durationSeconds)}
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="line-clamp-2 text-sm font-[470]">{video.title}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {[video.channel, video.views === null ? null : views(video.views, t)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
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
    <div className="mx-auto flex w-full max-w-[736px] flex-col gap-8 px-6 pt-6 pb-16">
      {turns.map((turn) => (
        <Each key={turn.id} question={turn.question} />
      ))}
    </div>
  );
};

export const ThreadImages: FC = () => <Turns Each={TurnImages} />;

export const ThreadVideos: FC = () => <Turns Each={TurnVideos} />;
