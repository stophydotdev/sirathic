"use client";

import { HoverCard } from "radix-ui";
import Image from "next/image";
import { type ComponentProps, type FC, type ReactNode, useContext, useState } from "react";
import { useChatState } from "@/components/chat";
import { Favicon } from "@/components/favicon";
import { siteName, SourcesContext } from "@/components/sources";
import { useVideoLine } from "@/components/videoLine";
import { api } from "@/lib/trpc";

export const useOpened = () => {
  const chat = useChatState();
  return (opening: string) => {
    const site = URL.parse(opening)?.hostname.replace(/^www\./u, "");
    if (!chat?.saved || !site) return;
    void api.events.record
      .mutate({ name: "source.opened", props: { site, where: "inline" } })
      .catch(() => undefined);
  };
};

export const PreviewRoot: FC<{ children: ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <HoverCard.Root
      open={open}
      onOpenChange={(next) => setOpen(next && !matchMedia("(hover: none)").matches)}
      openDelay={150}
      closeDelay={100}
    >
      {children}
    </HoverCard.Root>
  );
};

export const PreviewContent: FC<{ children: ReactNode }> = ({ children }) => (
  <HoverCard.Portal>
    <HoverCard.Content
      side="top"
      align="start"
      sideOffset={6}
      className="bg-card border-border z-50 flex w-80 flex-col rounded-xl border p-1 shadow-lg"
    >
      {children}
    </HoverCard.Content>
  </HoverCard.Portal>
);

export const LinkCard: FC<{ url: string }> = ({ url }) => {
  const sources = useContext(SourcesContext);
  const href = URL.parse(url)?.href;
  const source =
    sources.get(url) ?? sources.values().find((found) => URL.parse(found.url)?.href === href);
  const opened = useOpened();
  const videoLine = useVideoLine();
  const video = source?.video;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={() => opened(url)}
      className="hover:bg-muted flex flex-col gap-1 rounded-lg p-2 text-sm"
    >
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Favicon url={url} size={14} />
        <span className="line-clamp-1">
          {siteName(url)}
          {video && ` · ${video.channel}`}
        </span>
      </span>
      <span className="flex gap-2">
        {video?.thumbnail ? (
          <Image
            src={video.thumbnail}
            alt=""
            width={64}
            height={36}
            unoptimized
            className="bg-muted mt-0.5 h-9 w-16 shrink-0 rounded-md object-cover"
          />
        ) : null}
        <span className="flex min-w-0 flex-col">
          <span className="text-foreground line-clamp-2 font-medium">{source?.title ?? url}</span>
          {video && (
            <span className="text-muted-foreground text-xs tabular-nums">{videoLine(video)}</span>
          )}
        </span>
      </span>
      {source?.snippet ? (
        <span className="text-muted-foreground line-clamp-3 text-xs leading-5">
          {source.snippet}
        </span>
      ) : null}
    </a>
  );
};

export const PreviewLink: FC<ComponentProps<"a"> & { href: string }> = ({ href, ...props }) => {
  const opened = useOpened();
  return (
    <PreviewRoot>
      <HoverCard.Trigger asChild>
        <a target="_blank" rel="noreferrer" onClick={() => opened(href)} href={href} {...props} />
      </HoverCard.Trigger>
      <PreviewContent>
        <LinkCard url={href} />
      </PreviewContent>
    </PreviewRoot>
  );
};
