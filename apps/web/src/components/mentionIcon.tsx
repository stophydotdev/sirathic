import { Favicon } from "@/components/favicon";
import type { MentionTarget } from "@/components/mentionText";
import { cn } from "@/lib/utils";
import { IconSparkles } from "@tabler/icons-react";
import type { FC } from "react";

export const rootDomain = (url: string) =>
  URL.parse(url)?.hostname.split(".").slice(-2).join(".") ?? url;

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
        size={12}
        className="rounded-[2px] bg-transparent"
      />
    ) : (
      <IconSparkles className="size-3" />
    )}
  </span>
);
