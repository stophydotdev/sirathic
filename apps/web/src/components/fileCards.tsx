"use client";

import { useT } from "@/components/i18n";
import { FileTypeTile, FileViewer } from "@/components/fileViewer";
import { fileHref } from "@/components/libraryItems";
import { type ThreadMessage, useAuiState } from "@assistant-ui/react";
import { Download04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { formatSize, savedFiles } from "@sirathic/server/files";
import type { FC } from "react";
import { z } from "zod";

export const FILE_TOOLS = ["create_text_file", "create_research_report", "share_files"];

type ToolCallPart = Extract<ThreadMessage["content"][number], { type: "tool-call" }>;

type Saved = z.infer<typeof savedFiles>["files"][number];

const report = z.object({ title: z.string(), content: z.string() });

const previewOf = (markdown: string) =>
  markdown
    .replace(/^#[^\n]*\n+/u, "")
    .slice(0, 400)
    .replaceAll(/[#*`>_|-]+/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim();

const button =
  "bg-foreground/8 hover:bg-foreground/12 flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium no-underline! transition-colors";

const FileCard: FC<{ file: Saved }> = ({ file }) => {
  const t = useT();
  return (
    <div className="bot-card flex items-center gap-3">
      <FileViewer file={file}>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-start">
          <FileTypeTile file={file} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{file.name}</span>
            <span className="text-muted-foreground text-sm">{formatSize(file.size)}</span>
          </span>
        </button>
      </FileViewer>
      <a
        href={fileHref(file)}
        download={file.name}
        aria-label={t("Download")}
        className="text-muted-foreground hover:bg-foreground/8 hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-full no-underline! transition-colors"
      >
        <HugeiconsIcon icon={Download04Icon} className="size-5" />
      </a>
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
    <div className="bot-card flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <FileTypeTile file={file} className="size-8" />
        <span className="text-muted-foreground text-xs">{t("Research report")}</span>
      </div>
      <span className="text-sm font-medium">{title}</span>
      <span className="text-muted-foreground line-clamp-3 text-xs">{previewOf(content)}</span>
      <div className="flex gap-2">
        <FileViewer file={file}>
          <button type="button" className={button}>
            {t("Open")}
          </button>
        </FileViewer>
        <a href={fileHref(file)} download={file.name} className={button}>
          <HugeiconsIcon icon={Download04Icon} className="size-4" />
          {t("Download")}
        </a>
      </div>
    </div>
  );
};

export const FileResult: FC<{ part: ToolCallPart }> = ({ part }) => {
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
};

export const FileCards: FC = () => {
  const parts = useAuiState((s) => s.message.parts);
  return parts.map((part) =>
    part.type === "tool-call" &&
    (FILE_TOOLS.includes(part.toolName) || part.toolName === "code_execution") ? (
      <FileResult key={part.toolCallId} part={part} />
    ) : null,
  );
};
