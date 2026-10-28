import { faviconUrl } from "@/components/sources";
import { cn } from "@/lib/utils";
import Image from "next/image";
import type { FC } from "react";

export const Favicon: FC<{
  url: string;
  src?: string;
  size: 12 | 14 | 16 | 28;
  className?: string;
}> = ({ url, src, size, className }) => {
  return (
    <Image
      src={src ?? faviconUrl(url)}
      alt=""
      width={size}
      height={size}
      unoptimized
      style={{ width: size, height: size }}
      className={cn("bg-muted flex-none rounded-full", className)}
    />
  );
};
