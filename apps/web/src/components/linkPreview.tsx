"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
      openDelay={200}
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
      className="bg-card border-border z-50 flex w-60 flex-col rounded-xl border p-1 shadow-lg"
    >
      {children}
    </HoverCard.Content>
  </HoverCard.Portal>
);

const shownUrl = (url: string) => url.replace(/^https?:\/\/(?:www\.)?/u, "");

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
      className="hover:bg-muted flex flex-col gap-1.5 rounded-lg p-2 text-sm"
    >
      {video?.thumbnail ? (
        <Image
          src={video.thumbnail}
          alt=""
          width={224}
          height={126}
          unoptimized
          className="bg-muted aspect-video w-full rounded-md object-cover"
        />
      ) : null}
      <span className="text-foreground line-clamp-2 font-semibold">
        {source?.title ?? siteName(url)}
      </span>
      {video && (
        <span className="text-muted-foreground text-xs tabular-nums">{videoLine(video)}</span>
      )}
      {source?.snippet ? (
        <span className="text-muted-foreground line-clamp-2 text-xs leading-5">
          {source.snippet}
        </span>
      ) : null}
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Favicon url={url} size={14} />
        <span className="min-w-0 flex-1 truncate">{shownUrl(url)}</span>
        <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3.5 shrink-0 rtl:-scale-x-100" />
      </span>
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
