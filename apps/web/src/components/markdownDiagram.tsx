"use client";

import type { SyntaxHighlighterProps } from "@assistant-ui/react-markdown";
import {
  Cancel01Icon,
  CodeIcon,
  Flowchart01Icon,
  ArrowExpand01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Mounted } from "pele/lazy";
import { Dialog } from "radix-ui";
import { type FC, useEffect, useRef, useState } from "react";

import { useT } from "@/components/i18n";
import { CodeBlock } from "@/components/markdownCode";
import { TooltipIconButton } from "@/components/tooltipIconButton";

const FENCE = /^ {0,3}(?:`{3,}|~{3,}).*$/gmu;
const DIAGRAM_FENCE = /^ {0,3}(?:`{3,}|~{3,})\s*mermaid\b/u;
const OPEN_DIAGRAM = "diagram";

export const markOpenDiagram = (text: string) => {
  const fences = [...text.matchAll(FENCE)];
  const last = fences.at(-1);
  if (fences.length % 2 === 0 || !last || !DIAGRAM_FENCE.test(last[0])) return text;
  const end = last.index + last[0].length;
  return `${text.slice(0, last.index)}${last[0].replace("mermaid", OPEN_DIAGRAM)}${text.slice(end)}`;
};

const Pele: FC<{ code: string; onError: () => void; className?: string }> = ({
  code,
  onError,
  className,
}) => {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    let live = true;
    let mounted: Mounted | undefined;
    void import("pele/lazy")
      .then((pele) =>
        pele.mountAsync(element, code, {
          fontFamily: getComputedStyle(element).fontFamily,
          links: false,
          images: false,
          zoom: false,
          onError,
        }),
      )
      .then((diagram) => {
        if (live) mounted = diagram;
        else diagram.destroy();
      }, onError);
    return () => {
      live = false;
      mounted?.destroy();
    };
  }, [code, onError]);

  return <div ref={box} className={className} />;
};

const floating =
  "bg-card border-border/50 text-muted-foreground hover:text-foreground size-7 border";

export const MarkdownDiagram: FC<SyntaxHighlighterProps> = (props) => {
  const t = useT();
  const [view, setView] = useState<"diagram" | "code" | "failed">("diagram");
  const [full, setFull] = useState(false);

  if (view === "failed") return <CodeBlock {...props} />;
  if (view === "code") {
    return (
      <CodeBlock
        {...props}
        actions={
          <TooltipIconButton tooltip={t("Show diagram")} onClick={() => setView("diagram")}>
            <HugeiconsIcon icon={Flowchart01Icon} />
          </TooltipIconButton>
        }
      />
    );
  }

  return (
    <div className="diagram group/diagram relative my-3">
      <Pele code={props.code} onError={() => setView("failed")} className="[&_svg.pele]:mx-auto" />
      <div className="absolute end-0 top-0 flex gap-1 opacity-0 transition-opacity group-hover/diagram:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
        <TooltipIconButton
          tooltip={t("Show code")}
          side="top"
          onClick={() => setView("code")}
          className={floating}
        >
          <HugeiconsIcon icon={CodeIcon} />
        </TooltipIconButton>
        <Dialog.Root open={full} onOpenChange={setFull}>
          <Dialog.Trigger asChild>
            <TooltipIconButton tooltip={t("Full screen")} side="top" className={floating}>
              <HugeiconsIcon icon={ArrowExpand01Icon} />
            </TooltipIconButton>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="bg-background fixed inset-0 z-60" />
            <Dialog.Content
              aria-describedby={undefined}
              onClick={(event) => {
                if (event.target === event.currentTarget) setFull(false);
              }}
              className="diagram fixed inset-0 z-60 flex items-center justify-center overflow-auto p-8 outline-none"
            >
              <Dialog.Title className="sr-only">{t("Diagram")}</Dialog.Title>
              <Pele
                code={props.code}
                onError={() => setFull(false)}
                className="size-full max-w-5xl [&_svg.pele]:size-full!"
              />
              <Dialog.Close
                aria-label={t("Close")}
                className="text-muted-foreground hover:text-foreground hover:bg-muted absolute end-4 top-4 flex size-9 items-center justify-center rounded-full"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-5" />
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </div>
  );
};
