"use client";

import { useT } from "@/components/i18n";
import { useAccount } from "@/components/account";
import { MakerIcon } from "@/components/makerIcon";
import { ModelMenuContent } from "@/components/settings";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdownMenu";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import type { ComponentProps, FC } from "react";

export const composerControl =
  "text-foreground/80 hover:bg-accent hover:text-foreground data-[state=open]:bg-accent focus-visible:ring-ring relative inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11";

export const ModelPicker: FC<Pick<ComponentProps<typeof ModelMenuContent>, "side">> = ({
  side,
}) => {
  const unknown = useAccount((s) => s.status === undefined);
  const t = useT();
  const models = useAccount((s) => s.models);
  const chosen = useAccount((s) => s.chosen);
  const current = models.find((m) => m.slug === chosen) ?? models[0];

  if (unknown) {
    return <div className="h-8" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={current?.name ?? t("Model")} className={composerControl}>
        {current && (
          <MakerIcon maker={current.maker} className="text-muted-foreground size-4 shrink-0" />
        )}
        <span className={cn("max-w-40 truncate", current && "hidden sm:inline")}>
          {current?.name ?? t("Model")}
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          strokeWidth={2.25}
          className="text-muted-foreground size-3.5"
        />
      </DropdownMenuTrigger>
      <ModelMenuContent side={side} />
    </DropdownMenu>
  );
};
