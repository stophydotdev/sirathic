"use client";

import { useLocale, useT } from "@/components/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import type { api } from "@/lib/trpc";
import { type FileKind, formatSize, kindOf } from "@sirathic/server/files";
import { HugeiconsIcon } from "@hugeicons/react";
import { File02Icon, Image01Icon, MoreHorizontalIcon, Pdf01Icon } from "@hugeicons/core-free-icons";
import Image from "next/image";
import type { FC } from "react";

export type LibraryFile = Awaited<ReturnType<typeof api.files.list.query>>[number];

export const fileHref = (file: { id: string }) => `/api/files/${file.id}`;

const KIND_ICONS = {
  image: Image01Icon,
  pdf: Pdf01Icon,
  text: File02Icon,
} satisfies Record<FileKind, typeof Image01Icon>;

export const FileKindIcon: FC<{ mediaType: string; className?: string }> = ({
  mediaType,
  className,
}) => {
  return <HugeiconsIcon icon={KIND_ICONS[kindOf(mediaType)]} className={className} />;
};

const Thumb: FC<{ file: LibraryFile; sizes: string }> = ({ file, sizes }) =>
  kindOf(file.mediaType) === "image" ? (
    <Image src={fileHref(file)} alt="" fill unoptimized sizes={sizes} className="object-cover" />
  ) : (
    <FileKindIcon mediaType={file.mediaType} className="text-muted-foreground size-6" />
  );

const useMeta = () => {
  const locale = useLocale();
  return (file: LibraryFile) =>
    `${formatSize(file.size)} · ${new Date(file.createdAt).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })}`;
};

type ItemProps = {
  file: LibraryFile;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
};

const FileMenu: FC<Omit<ItemProps, "onOpen">> = ({ file, onRename, onDelete }) => {
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("File actions")}
        className="text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-foreground/10 flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <a href={fileHref(file)} target="_blank" rel="noopener">
            {t("Open in new tab")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onRename}>{t("Rename")}</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          {t("Delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const FileTile: FC<ItemProps> = ({ file, onOpen, ...menu }) => {
  const meta = useMeta();
  return (
    <div className="rise flex min-w-0 flex-col gap-2">
      <button
        type="button"
        onClick={onOpen}
        aria-label={file.name}
        className="bg-muted hover:bg-foreground/10 relative grid aspect-square place-items-center overflow-hidden rounded-2xl transition-colors"
      >
        <Thumb file={file} sizes="(min-width: 1024px) 240px, 50vw" />
      </button>
      <div className="flex min-w-0 items-start gap-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-[550]">{file.name}</span>
          <span className="text-muted-foreground truncate text-xs">{meta(file)}</span>
        </div>
        <FileMenu file={file} {...menu} />
      </div>
    </div>
  );
};

export const FileRow: FC<ItemProps> = ({ file, onOpen, ...menu }) => {
  const meta = useMeta();
  return (
    <div className="rise border-foreground/10 flex h-16 min-w-0 items-center gap-3 border-b">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <span className="bg-muted relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg">
          <Thumb file={file} sizes="40px" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-[550]">{file.name}</span>
          <span className="text-muted-foreground truncate text-xs">{meta(file)}</span>
        </span>
      </button>
      <FileMenu file={file} {...menu} />
    </div>
  );
};
