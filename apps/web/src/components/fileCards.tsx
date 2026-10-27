"use client";

import { useT } from "@/components/i18n";
import { FileKindIcon, fileHref } from "@/components/libraryItems";
import { useAuiState } from "@assistant-ui/react";
import { Download04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { formatSize, savedFiles } from "@sirathic/server/files";
import type { FC } from "react";
import { z } from "zod";

export const FILE_TOOLS = ["create_text_file", "create_research_report", "share_files"];

type Saved = z.infer<typeof savedFiles>["files"][number];

const report = z.object({ title: z.string(), content: z.string() });

const previewOf = (markdown: string) =>
  markdown
    .replace(/^#[^\n]*\n+/u, "")
    .slice(0, 400)
    .replaceAll(/[#*`>_|-]+/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim();

const card =
  "border-foreground/10 bg-background my-3 flex w-full max-w-lg flex-col gap-3 rounded-3xl border px-4 py-3 print:hidden";

const button =
  "bg-foreground/8 hover:bg-foreground/12 flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium no-underline! transition-colors";

const FileCard: FC<{ file: Saved }> = ({ file }) => {
  const t = useT();
  return (
    <div className={card}>
      <div className="flex min-w-0 items-center gap-3">
        <a
          href={fileHref(file)}
          target="_blank"
          rel="noopener"
          className="flex min-w-0 flex-1 items-center gap-3 no-underline!"
        >
          <span className="bg-muted grid size-10 shrink-0 place-items-center rounded-xl">
            <FileKindIcon mediaType={file.mediaType} className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{file.name}</span>
            <span className="text-muted-foreground text-xs">{formatSize(file.size)}</span>
          </span>
        </a>
        <a
          href={fileHref(file)}
          download={file.name}
          aria-label={t("Download")}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-full no-underline! transition-colors"
        >
          <HugeiconsIcon icon={Download04Icon} className="size-4" />
        </a>
      </div>
    </div>
  );
};

const ReportCard: FC<{ file: Saved; title: string; content: string }> = ({
  file,
  title,
  content,
}) => {
  const t = useT();
  return (
    <div className={card}>
      <span className="text-muted-foreground text-xs">{t("Research report")}</span>
      <span className="text-sm font-medium">{title}</span>
      <span className="text-muted-foreground line-clamp-3 text-xs">{previewOf(content)}</span>
      <div className="flex gap-2">
        <a href={fileHref(file)} target="_blank" rel="noopener" className={button}>
          {t("Open")}
        </a>
        <a href={fileHref(file)} download={file.name} className={button}>
          <HugeiconsIcon icon={Download04Icon} className="size-4" />
          {t("Download")}
        </a>
      </div>
    </div>
  );
};

export const FileCards: FC = () => {
  const parts = useAuiState((s) => s.message.parts);
  return parts.map((part) => {
    if (part.type !== "tool-call" || !FILE_TOOLS.includes(part.toolName)) return null;
    const { files } = savedFiles.safeParse(part.result).data ?? { files: [] };
    const doc =
      part.toolName === "create_research_report" ? report.safeParse(part.args).data : undefined;
    return files.map((file) =>
      doc ? (
        <ReportCard key={file.id} file={file} title={doc.title} content={doc.content} />
      ) : (
        <FileCard key={file.id} file={file} />
      ),
    );
  });
};
