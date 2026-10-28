const DAY = 86_400_000;

const dayStart = (at: number) => new Date(at).setHours(0, 0, 0, 0);

export const STAMP_GAP = 30 * 60_000;

export const stampText = (locale: string, at: number, now: number) => {
  const days = Math.round((dayStart(at) - dayStart(now)) / DAY);
  const day =
    days === 0 || days === -1
      ? new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day")
      : new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(at);
  return `${day} ${new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(at)}`;
};
