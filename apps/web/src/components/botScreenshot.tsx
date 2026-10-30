import { Favicon } from "@/components/favicon";
import { siteName } from "@/components/sources";
import Image from "next/image";
import type { FC } from "react";
import { z } from "zod";

export const shownScreenshot = z.object({
  url: z.string(),
  title: z.string(),
  jpeg: z.string(),
  shown: z.literal(true),
});

export const ScreenshotCard: FC<{ shot: z.infer<typeof shownScreenshot> }> = ({ shot }) => (
  <div className="bot-card flex flex-col gap-2.5 p-3">
    <Image
      src={`data:image/jpeg;base64,${shot.jpeg}`}
      alt={shot.title}
      width={1280}
      height={800}
      unoptimized
      className="h-auto w-full rounded-xl"
    />
    <div className="flex min-w-0 items-center gap-2 px-1 text-sm">
      <Favicon url={shot.url} size={16} />
      <span className="truncate font-medium">{shot.title}</span>
      <span className="text-muted-foreground truncate">{siteName(shot.url)}</span>
    </div>
  </div>
);
