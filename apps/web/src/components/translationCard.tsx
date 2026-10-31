"use client";

import { useT } from "@/components/i18n";
import { Swap } from "@/components/swap";
import { TooltipIconButton } from "@/components/tooltipIconButton";
import { useCopyToClipboard } from "@/lib/hooks/useCopyToClipboard";
import { translation as translationSchema } from "@sirathic/server/cards";
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { FC } from "react";

export const TranslationCard: FC<{ args: unknown }> = ({ args }) => {
  const shown = translationSchema.safeParse(args).data;
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const t = useT();
  if (!shown) return null;

  return (
    <div className="bg-foreground/7 my-4 flex flex-col gap-1 rounded-3xl p-1.5">
      <div className="px-3 pt-2 pb-3">
        <p className="text-muted-foreground mb-1 text-sm">{shown.sourceLanguage}</p>
        <p dir="auto" className="leading-relaxed">
          {shown.text}
        </p>
      </div>
      <div className="bg-background rounded-2xl px-3 pt-2 pb-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-sm">{shown.targetLanguage}</p>
          <TooltipIconButton
            tooltip={t("Copy")}
            side="top"
            onClick={() => copyToClipboard(shown.translation)}
            className="text-muted-foreground hover:text-foreground -me-1 size-7"
          >
            <Swap
              swapped={isCopied}
              from={<HugeiconsIcon icon={Copy01Icon} />}
              to={<HugeiconsIcon icon={Tick02Icon} />}
            />
          </TooltipIconButton>
        </div>
        <p lang={shown.targetLang} dir="auto" className="text-xl leading-loose">
          {shown.translation}
        </p>
        {shown.pronunciation && (
          <p className="text-muted-foreground mt-1 leading-relaxed">{shown.pronunciation}</p>
        )}
      </div>
    </div>
  );
};
