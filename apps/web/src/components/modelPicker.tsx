"use client";

import { useT } from "@/components/i18n";
import { useAccount, useCurrentModel } from "@/components/account";
import { useEffortName } from "@/components/effortPicker";
import { ModelMenuContent } from "@/components/settings";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdownMenu";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import type { ComponentProps, FC } from "react";

const composerControl =
  "text-foreground/80 hover:bg-accent hover:text-foreground data-[state=open]:bg-accent focus-visible:ring-ring relative inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11";

export const ModelPicker: FC<ComponentProps<typeof ModelMenuContent>> = ({ side }) => {
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
      <DropdownMenuTrigger aria-label={`${name}, ${effortName}`} className={composerControl}>
        <span className="max-w-40 truncate">{name}</span>
        <span className="text-muted-foreground font-normal">{effortName}</span>
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
