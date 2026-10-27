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
      <DropdownMenuTrigger
        aria-label={current?.name ?? t("Model")}
        className="text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-[470] transition-colors sm:px-3"
      >
        {current && <MakerIcon maker={current.maker} className="size-4 shrink-0" />}
        <span className={cn("max-w-40 truncate", current && "hidden sm:inline")}>
          {current?.name ?? t("Model")}
        </span>
        <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
      </DropdownMenuTrigger>
      <ModelMenuContent side={side} />
    </DropdownMenu>
  );
};
