import { useLocale, useT } from "@/components/i18n";
import { type Source, videoLength } from "@sirathic/server/sources";

export type SourceVideo = NonNullable<Source["video"]>;

export const useVideoLine = () => {
  const t = useT();
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
  const count = new Intl.NumberFormat(locale, { notation: "compact" });

  return (video: SourceVideo) => {
    const published = video.published ? new Date(video.published) : undefined;
    return [
      video.seconds !== undefined && videoLength(video.seconds),
      published && !Number.isNaN(published.getTime()) && date.format(published),
      video.views !== undefined && t("{count} views", { count: count.format(video.views) }),
    ]
      .filter(Boolean)
      .join(" · ");
  };
};
