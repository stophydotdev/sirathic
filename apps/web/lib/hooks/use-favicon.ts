"use client";

import { useCallback, useState } from "react";
import { getFaviconUrl } from "@/lib/favicon";

export function useFavicon(url?: string) {
  const resolved = url ? getFaviconUrl(url) : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = resolved && resolved !== failedSrc ? resolved : null;

  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || !src) return;

      let released = false;
      img.decode().catch(() => {
        if (!released) setFailedSrc(src);
      });

      return () => {
        released = true;
      };
    },
    [src],
  );

  return { src, ref };
}
