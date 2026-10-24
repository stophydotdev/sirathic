"use client";

import { saveDraft } from "@/components/draft";
import { useLocalePath, useT } from "@/components/i18n";
import { type FC, useEffect, useState } from "react";

const MAX_CHARS = 1_000;
const TOOLBAR_HEIGHT = 44;
const EDGE = 88;

type Picked = {
  text: string;
  reference: string;
  top: number;
  left: number;
};

const referenceOf = (node: Node) =>
  (node instanceof Element ? node : node.parentElement)?.closest(
    "[data-ask-ref]",
  );

const pickedText = (): Picked | undefined => {
  const selection = document.getSelection();
  const text = selection?.toString().trim() ?? "";
  if (!selection || selection.rangeCount === 0 || text.length < 2) {
    return undefined;
  }
  const range = selection.getRangeAt(0);
  const start = referenceOf(range.startContainer);
  if (!start || start !== referenceOf(range.endContainer)) return undefined;
  const box = range.getBoundingClientRect();
  const below = matchMedia("(pointer: coarse)").matches;
  return {
    text: text.slice(0, MAX_CHARS),
    reference: start.getAttribute("data-ask-ref") ?? "",
    top: below ? box.bottom + 8 : box.top - TOOLBAR_HEIGHT,
    left: Math.min(
      Math.max(box.left + box.width / 2, EDGE),
      window.innerWidth - EDGE,
    ),
  };
};

export const AskSelection: FC = () => {
  const t = useT();
  const href = useLocalePath();
  const [picked, setPicked] = useState<Picked>();

  useEffect(() => {
    const update = () => setPicked(pickedText());
    document.addEventListener("selectionchange", update);
    window.addEventListener("scroll", update, true);
    return () => {
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("scroll", update, true);
    };
  }, []);

  if (!picked) return null;
  const quoted = `“${picked.text}” (${picked.reference})`;

  const ask = () => {
    saveDraft(`${quoted}\n`);
    window.location.assign(href("/"));
  };

  const copy = () => {
    void navigator.clipboard.writeText(quoted);
    document.getSelection()?.removeAllRanges();
  };

  const button = "h-8 rounded-md px-3 text-sm transition-colors hover:bg-muted";

  return (
    <div
      role="toolbar"
      aria-label={t("Ask Sirathic")}
      onMouseDown={(event) => event.preventDefault()}
      style={{ top: picked.top, left: picked.left }}
      className="bg-popover border-border fixed z-50 flex -translate-x-1/2 gap-0.5 rounded-lg border p-1 shadow-lg print:hidden"
    >
      <button
        type="button"
        onClick={ask}
        className="bg-primary text-primary-foreground h-8 rounded-md px-3 text-sm font-[470] hover:opacity-90"
      >
        {t("Ask Sirathic")}
      </button>
      <button type="button" onClick={copy} className={button}>
        {t("Copy")}
      </button>
    </div>
  );
};
