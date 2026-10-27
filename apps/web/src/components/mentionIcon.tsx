import { Favicon } from "@/components/favicon";
import type { MentionTarget } from "@/components/mentionText";
import { cn } from "@/lib/utils";
import { CONNECTORS } from "@sirathic/server/catalog";
import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon } from "@hugeicons/core-free-icons";
import type { FC } from "react";

export const rootDomain = (url: string) =>
  URL.parse(url)?.hostname.split(".").slice(-2).join(".") ?? url;

export const catalogIcon = (url: string) => {
  const known = Object.values(CONNECTORS).find((connector) => connector.url === url);
  return known && "icon" in known ? known.icon : undefined;
};

export const MentionIcon: FC<{ target: MentionTarget; className?: string }> = ({
  target,
  className,
}) => (
  <span
    className={cn(
      "bg-muted ring-foreground/10 text-muted-foreground inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] ring-1 ring-inset",
      className,
    )}
  >
    {target.url ? (
      <Favicon
        url={`https://${rootDomain(target.url)}`}
        src={catalogIcon(target.url)}
        size={12}
        className="rounded-[2px] bg-transparent"
      />
    ) : (
      <HugeiconsIcon icon={SparklesIcon} className="size-3" />
    )}
  </span>
);
