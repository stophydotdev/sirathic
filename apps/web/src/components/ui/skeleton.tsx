import { cn } from "@/lib/utils";
import type { FC } from "react";

export const Skeleton: FC<{ className: string }> = ({ className }) => (
  <div aria-hidden className={cn("bg-foreground/7 rounded-md", className)} />
);
