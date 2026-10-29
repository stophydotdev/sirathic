"use client";

import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Element, ElementContent } from "hast";
import type { ComponentProps, FC } from "react";

import { useT } from "@/components/i18n";
import { Swap } from "@/components/swap";
import { TooltipIconButton } from "@/components/tooltipIconButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { useCopyToClipboard } from "@/lib/hooks/useCopyToClipboard";
import { cn } from "@/lib/utils";

const isCitation = (node: Element) => node.tagName === "a" && "dataUrls" in node.properties;

const textOf = (node: ElementContent): string => {
  if (node.type === "text") return node.value;
  if (node.type !== "element" || isCitation(node) || node.tagName === "figure") return "";
  return node.children.map(textOf).join("");
};

export const rowsOf = (node: Element): string[][] =>
  node.children.flatMap((child) => {
    if (child.type !== "element") return [];
    if (child.tagName !== "tr") return rowsOf(child);
    return [
      child.children.flatMap((cell) => (cell.type === "element" ? [textOf(cell).trim()] : [])),
    ];
  });

const markdownRow = (cells: string[]) =>
  `| ${cells.map((cell) => cell.replaceAll("|", "\\|")).join(" | ")} |`;

export const tableMarkdown = (rows: string[][]) => {
  const [head = [], ...body] = rows;
  return [markdownRow(head), markdownRow(head.map(() => "---")), ...body.map(markdownRow)].join(
    "\n",
  );
};

const csvCell = (cell: string) => (/[",\n]/u.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell);

export const tableCsv = (rows: string[][]) =>
  rows.map((row) => row.map(csvCell).join(",")).join("\n");

export const MarkdownTable: FC<ComponentProps<"table"> & { node?: Element }> = ({
  node,
  className,
  ...props
}) => {
  const t = useT();
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const copy = (format: (rows: string[][]) => string) => {
    if (node) copyToClipboard(format(rowsOf(node)));
  };

  return (
    <div className="group/table relative my-3">
      <div className="aui-md-table-wrapper border-border/50 overflow-x-auto rounded-lg border">
        <table
          className={cn("aui-md-table w-full border-collapse text-sm leading-5", className)}
          {...props}
        />
      </div>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <TooltipIconButton
            tooltip={t("Copy table")}
            side="top"
            className="bg-card border-border/50 text-muted-foreground hover:text-foreground absolute end-1.5 top-1.5 size-7 border opacity-0 transition-opacity group-hover/table:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
          >
            <Swap
              swapped={isCopied}
              from={<HugeiconsIcon icon={Copy01Icon} />}
              to={<HugeiconsIcon icon={Tick02Icon} />}
            />
          </TooltipIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="border-foreground/6 w-52 rounded-2xl border p-1.5"
        >
          <DropdownMenuItem
            className="h-8 gap-2 rounded-lg px-2"
            onSelect={() => copy(tableMarkdown)}
          >
            {t("Copy as Markdown")}
          </DropdownMenuItem>
          <DropdownMenuItem className="h-8 gap-2 rounded-lg px-2" onSelect={() => copy(tableCsv)}>
            {t("Copy as CSV")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
