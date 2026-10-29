"use client";

import { Favicon } from "@/components/favicon";
import { siteName, sourcesOf } from "@/components/sources";
import { useVideoLine } from "@/components/videoLine";
import type { Source } from "@sirathic/server/sources";
import { useAuiState } from "@assistant-ui/react";
import Image from "next/image";
import { type FC, useEffect, useRef } from "react";

const readable = (url: string) => {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
};

export const LinksView: FC = () => {
  const messages = useAuiState((s) => s.thread.messages);
  const videoLine = useVideoLine();
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    void list.current?.scrollIntoView({ block: "start" });
  }, []);
  const found = new Map<string, Source>();
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const source of sourcesOf(message.content)) {
      if (!found.has(source.url)) found.set(source.url, source);
    }
  }

  return (
    <ol ref={list} className="flex scroll-mt-16 flex-col gap-6 pt-4 pb-8">
      {[...found.values()].map((source) => (
        <li key={source.url} className="flex gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <Favicon url={source.url} size={28} />
              <div className="min-w-0">
                <p className="text-foreground text-sm">
                  {siteName(source.url)}
                  {source.video && ` · ${source.video.channel}`}
                </p>
                <p className="text-muted-foreground truncate text-xs">{readable(source.url)}</p>
              </div>
            </div>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="text-super mt-1.5 line-clamp-1 text-base hover:underline"
            >
              {source.title}
            </a>
            {source.video && (
              <p className="text-muted-foreground text-xs tabular-nums">
                {videoLine(source.video)}
              </p>
            )}
            <p className="text-muted-foreground line-clamp-2 text-sm">{source.snippet}</p>
          </div>
          {source.video?.thumbnail ? (
            <Image
              src={source.video.thumbnail}
              alt=""
              width={112}
              height={64}
              unoptimized
              className="bg-muted mt-1 h-16 w-28 shrink-0 rounded-lg object-cover"
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
};
