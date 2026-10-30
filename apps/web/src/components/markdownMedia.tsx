"use client";

import { Cancel01Icon, ArrowExpand01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Dialog } from "radix-ui";
import { type ComponentProps, type FC, useState } from "react";
import { z } from "zod";

import { useT } from "@/components/i18n";

const VIDEO = /\.(mp4|webm|mov|m4v|ogv)(?:[?#]|$)/iu;
const AUDIO = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)(?:[?#]|$)/iu;
const source = z.string().min(1);

export const MarkdownMedia: FC<ComponentProps<"img">> = ({ src, alt }) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const url = source.safeParse(src).data;
  if (!url) return null;
  if (VIDEO.test(url)) {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="my-3 block max-h-96 w-full rounded-xl bg-black"
      />
    );
  }
  if (AUDIO.test(url)) {
    return (
      <audio src={url} controls preload="metadata" className="my-3 block w-full dark:scheme-dark" />
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <span className="my-3 block">
        <Dialog.Trigger
          aria-label={t("Open image")}
          className="group/image relative block max-w-full cursor-zoom-in overflow-hidden rounded-xl"
        >
          <img src={url} alt={alt ?? ""} className="block max-h-96 max-w-full" />
          <span className="bg-background/80 text-foreground absolute end-2 top-2 flex size-7 items-center justify-center rounded-lg opacity-0 transition-opacity group-hover/image:opacity-100 pointer-coarse:opacity-100">
            <HugeiconsIcon icon={ArrowExpand01Icon} className="size-4" />
          </span>
        </Dialog.Trigger>
        {alt && <span className="text-muted-foreground mt-1.5 block text-xs">{alt}</span>}
      </span>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-60 bg-black/90" />
        <Dialog.Content
          aria-describedby={undefined}
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          className="fixed inset-0 z-60 flex items-center justify-center p-4 outline-none"
        >
          <Dialog.Title className="sr-only">{alt || t("Image")}</Dialog.Title>
          <img src={url} alt={alt ?? ""} className="max-h-full max-w-full object-contain" />
          <Dialog.Close
            aria-label={t("Close")}
            className="absolute end-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-5" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
