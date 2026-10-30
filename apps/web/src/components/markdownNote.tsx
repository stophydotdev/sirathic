"use client";

import {
  Alert02Icon,
  AlertCircleIcon,
  AlertDiamondIcon,
  BulbIcon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Element, Root, RootContent } from "hast";
import type { FC, ReactNode } from "react";
import { z } from "zod";

import { useT } from "@/components/i18n";
import { cn } from "@/lib/utils";

const noteKind = z.enum(["note", "tip", "important", "warning", "caution"]);

const NOTES = {
  note: { label: "Note", icon: InformationCircleIcon, tone: "border-super text-super" },
  tip: {
    label: "Tip",
    icon: BulbIcon,
    tone: "border-emerald-500/70 text-emerald-600 dark:text-emerald-400",
  },
  important: {
    label: "Important",
    icon: AlertCircleIcon,
    tone: "border-violet-500/70 text-violet-600 dark:text-violet-400",
  },
  warning: {
    label: "Warning",
    icon: Alert02Icon,
    tone: "border-amber-500/70 text-amber-600 dark:text-amber-500",
  },
  caution: {
    label: "Caution",
    icon: AlertDiamondIcon,
    tone: "border-red-500/70 text-red-600 dark:text-red-400",
  },
} as const;

const MARKER = new RegExp(`^\\[!(${noteKind.options.join("|")})\\]\\s*`, "iu");

const isBlank = (node: RootContent) => node.type === "text" && node.value.trim() === "";

function markNote(quote: Element) {
  const first = quote.children.find((child) => !isBlank(child));
  if (first?.type !== "element" || first.tagName !== "p") return;
  const [text] = first.children;
  if (text?.type !== "text") return;
  const match = MARKER.exec(text.value);
  if (!match) return;
  text.value = text.value.slice(match[0].length);
  if (text.value === "") first.children.shift();
  if (first.children.length === 0) quote.children.splice(quote.children.indexOf(first), 1);
  quote.tagName = "aside";
  quote.properties.dataNote = match[1]?.toLowerCase();
}

function walk(parent: Root | Element) {
  for (const child of parent.children) {
    if (child.type !== "element") continue;
    if (child.tagName === "blockquote") markNote(child);
    walk(child);
  }
}

export const rehypeNotes = () => (tree: Root) => walk(tree);

export const Note: FC<{ node?: Element; children?: ReactNode }> = ({ node, children }) => {
  const t = useT();
  const kind = noteKind.safeParse(node?.properties.dataNote).data;
  if (!kind) return <aside>{children}</aside>;
  const { label, icon, tone } = NOTES[kind];
  return (
    <aside role="note" dir="auto" className={cn("my-3 border-s-2 ps-3.5", tone)}>
      <p className="mb-1 flex items-center gap-1.5 text-sm font-medium">
        <HugeiconsIcon icon={icon} className="size-4 shrink-0" />
        {t(label)}
      </p>
      <div className="text-foreground">{children}</div>
    </aside>
  );
};
