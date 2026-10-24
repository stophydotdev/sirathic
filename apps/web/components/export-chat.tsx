"use client";

import { useT } from "@/components/i18n";
import { download } from "@/components/answer-actions";
import { sourcesOf } from "@/components/sources";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ThreadMessage, useAui } from "@assistant-ui/react";
import { IconDownload, IconFileText, IconPrinter } from "@tabler/icons-react";
import type { FC } from "react";

const textOf = (message: ThreadMessage) =>
  message.content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();

function chatMarkdown(messages: readonly ThreadMessage[]) {
  return messages
    .map((message) => {
      if (message.role === "user") return `## ${textOf(message)}`;
      const sources = sourcesOf(message.content)
        .map((source, i) => `${i + 1}. [${source.title}](${source.url})`)
        .join("\n");
      return sources
        ? `${textOf(message)}\n\n**Sources**\n\n${sources}`
        : textOf(message);
    })
    .join("\n\n");
}

export const ExportMenu: FC<{ onPrint: () => void }> = ({ onPrint }) => {
  const aui = useAui();
  const t = useT();

  const save = () => {
    const { messages } = aui.thread().getState();
    const first = messages.find((message) => message.role === "user");
    const title = first ? textOf(first) : t("Chat");
    download(title, `${chatMarkdown(messages)}\n`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("Export this chat")}
        title={t("Export this chat")}
        className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center rounded-full transition-colors"
      >
        <IconDownload className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={save}>
          <IconFileText className="size-4" />
          {t("Download Markdown")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onPrint}>
          <IconPrinter className="size-4" />
          {t("Save as PDF")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
