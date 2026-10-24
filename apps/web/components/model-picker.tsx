"use client";

import { useT } from "@/components/i18n";
import { useAccount } from "@/components/account";
import { MakerIcon } from "@/components/maker-icon";
import { ModelMenuContent, useSettings } from "@/components/settings";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { IconChevronDown } from "@tabler/icons-react";
import type { ComponentProps, FC } from "react";

export const ModelPicker: FC<
  Pick<ComponentProps<typeof ModelMenuContent>, "side">
> = ({ side }) => {
  const unknown = useAccount((s) => s.status === undefined);
  const t = useT();
  const models = useAccount((s) => s.models);
  const chosen = useAccount((s) => s.chosen);
  const showSettings = useSettings((s) => s.show);
  const current = models.find((m) => m.slug === chosen) ?? models[0];

  if (unknown) {
    return (
      <div className="flex h-8 items-center px-3">
        <Skeleton className="h-2.5 w-8 sm:w-20" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-[470] transition-colors sm:px-3">
        {current && (
          <MakerIcon maker={current.maker} className="size-4 shrink-0" />
        )}
        <span className="hidden max-w-40 truncate sm:inline">
          {current?.name ?? t("Model")}
        </span>
        <IconChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <ModelMenuContent side={side} onManage={() => showSettings("models")} />
    </DropdownMenu>
  );
};
