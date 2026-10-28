"use client";

import { useT } from "@/components/i18n";
import { useAccount, useCurrentModel } from "@/components/account";
import { useEffortName } from "@/components/effortPicker";
import { MakerIcon } from "@/components/makerIcon";
import { ModelMenuContent } from "@/components/settings";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdownMenu";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import type { ComponentProps, FC } from "react";

const composerControl =
  "text-foreground/80 hover:bg-accent hover:text-foreground data-[state=open]:bg-accent focus-visible:ring-ring relative inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11";

export const ModelPicker: FC<ComponentProps<typeof ModelMenuContent>> = ({ side, effort }) => {
  const unknown = useAccount((s) => s.status === undefined);
  const t = useT();
  const current = useCurrentModel();
  const effortName = useEffortName();
  const name = current?.name ?? t("Model");

  if (unknown) {
    return <div className="h-8" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={effort ? `${name}, ${effortName}` : name}
        className={composerControl}
      >
        {current && (
          <MakerIcon maker={current.maker} className="text-muted-foreground size-4 shrink-0" />
        )}
        <span className={cn("max-w-40 truncate", current && "hidden sm:inline")}>{name}</span>
        {effort && (
          <span className="text-muted-foreground hidden font-normal sm:inline">{effortName}</span>
        )}
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          strokeWidth={2.25}
          className="text-muted-foreground size-3.5"
        />
      </DropdownMenuTrigger>
      <ModelMenuContent side={side} effort={effort} />
    </DropdownMenu>
  );
};
