"use client";

import { useT } from "@/components/i18n";
import { csvRows } from "@/components/csvRows";
import { fileHref } from "@/components/libraryItems";
import { panel } from "@/components/sessionMenu";
import { cn } from "@/lib/utils";
import {
  Cancel01Icon,
  Csv01Icon,
  Doc01Icon,
  Download04Icon,
  File02Icon,
  Image01Icon,
  Pdf01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { DOCX, formatSize } from "@sirathic/server/files";
import { Dialog } from "radix-ui";
import { type FC, type ReactNode, useEffect, useState } from "react";

export type ViewedFile = { id: string; name: string; mediaType: string; size: number };

const MAX_TEXT_CHARS = 200_000;
const MAX_ROWS = 500;

const KINDS = {
  image: { icon: Image01Icon, tile: "bg-violet-500/15 text-violet-400" },
  pdf: { icon: Pdf01Icon, tile: "bg-red-500/15 text-red-400" },
  word: { icon: Doc01Icon, tile: "bg-blue-500/15 text-blue-400" },
  csv: { icon: Csv01Icon, tile: "bg-emerald-500/15 text-emerald-400" },
  text: { icon: File02Icon, tile: "bg-foreground/8 text-muted-foreground" },
} as const;

const kindOf = (file: ViewedFile): keyof typeof KINDS => {
  if (file.mediaType.startsWith("image/")) return "image";
  if (file.mediaType === "application/pdf") return "pdf";
  if (file.mediaType === DOCX) return "word";
  return /\.csv$/iu.test(file.name) ? "csv" : "text";
};

export const FileTypeTile: FC<{ file: ViewedFile; className?: string }> = ({ file, className }) => {
  const { icon, tile } = KINDS[kindOf(file)];
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tile, className)}>
      <HugeiconsIcon icon={icon} className="size-5" />
    </span>
  );
};

type Loaded = { kind: "ready"; text: string } | { kind: "failed" };

const useFileText = (file: ViewedFile, wanted: boolean) => {
  const [loaded, setLoaded] = useState<Loaded>();
  useEffect(() => {
    if (!wanted) return;
    let current = true;
    fetch(fileHref(file))
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error("failed"))))
      .then((text) => current && setLoaded({ kind: "ready", text }))
      .catch(() => current && setLoaded({ kind: "failed" }));
    return () => {
      current = false;
    };
  }, [file, wanted]);
  return loaded;
};

const Note: FC<{ text: string }> = ({ text }) => (
  <p className="text-muted-foreground grid h-full place-items-center p-6 text-center text-sm">
    {text}
  </p>
);

const Sheet: FC<{ rows: string[][] }> = ({ rows }) => (
  <table className="w-max min-w-full border-collapse text-sm">
    <tbody>
      {rows.map((row, index) => (
        <tr key={index} className={index === 0 ? "bg-foreground/5 font-[550]" : undefined}>
          <th className="text-muted-foreground border-foreground/10 sticky left-0 border-r border-b bg-background px-3 py-1.5 text-end text-xs font-normal">
            {index + 1}
          </th>
          {row.map((cell, column) => (
            <td key={column} className="border-foreground/10 border-r border-b px-3 py-1.5">
              {cell}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

const Body: FC<{ file: ViewedFile; loaded: Loaded | undefined; rows: string[][] | undefined }> = ({
  file,
  loaded,
  rows,
}) => {
  const t = useT();
  const kind = kindOf(file);
  if (kind === "pdf")
    return <iframe src={fileHref(file)} title={file.name} className="size-full" />;
  if (kind === "image") {
    return <img src={fileHref(file)} alt={file.name} className="size-full object-contain p-4" />;
  }
  if (kind === "word" || loaded?.kind === "failed") {
    return <Note text={t("This file can't be shown here. Download it to open it.")} />;
  }
  if (loaded?.kind !== "ready") return null;
  if (rows) return <Sheet rows={rows} />;
  return (
    <pre className="p-4 text-sm whitespace-pre-wrap break-words">
      {loaded.text.slice(0, MAX_TEXT_CHARS)}
    </pre>
  );
};

const iconButton =
  "text-muted-foreground hover:bg-foreground/8 hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-full no-underline! transition-colors";

const Viewed: FC<{ file: ViewedFile }> = ({ file }) => {
  const t = useT();
  const kind = kindOf(file);
  const loaded = useFileText(file, kind === "csv" || kind === "text");
  const rows =
    kind === "csv" && loaded?.kind === "ready"
      ? csvRows(loaded.text).slice(0, MAX_ROWS)
      : undefined;
  const meta = [
    formatSize(file.size),
    rows && (rows.length === 1 ? t("1 row") : t("{count} rows", { count: rows.length })),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <div className="border-foreground/10 flex h-16 shrink-0 items-center gap-3 border-b px-4">
        <FileTypeTile file={file} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Dialog.Title className="truncate text-sm font-[550]">{file.name}</Dialog.Title>
          <span className="text-muted-foreground truncate text-xs">{meta}</span>
        </div>
        <a
          href={fileHref(file)}
          download={file.name}
          aria-label={t("Download")}
          className={iconButton}
        >
          <HugeiconsIcon icon={Download04Icon} className="size-5" />
        </a>
        <Dialog.Close aria-label={t("Close")} className={iconButton}>
          <HugeiconsIcon icon={Cancel01Icon} className="size-5" />
        </Dialog.Close>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <Body file={file} loaded={loaded} rows={rows} />
      </div>
    </>
  );
};

export const FileViewer: FC<{ file: ViewedFile; children: ReactNode }> = ({ file, children }) => (
  <Dialog.Root>
    <Dialog.Trigger asChild>{children}</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="dim fixed inset-0 z-[60] bg-black/60" />
      <Dialog.Content
        aria-describedby={undefined}
        className={cn(
          panel,
          "h-dvh w-screen max-w-none overflow-hidden rounded-none sm:h-[85dvh] sm:w-screen sm:max-w-4xl sm:rounded-[20px]",
        )}
      >
        <Viewed file={file} />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);
