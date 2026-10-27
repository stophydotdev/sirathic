const DAY_MS = 86_400_000;

const dayStart = (at: Date) => new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();

export const whenOf = (locale: string, iso: string, now = new Date()) => {
  const at = new Date(iso);
  const days = Math.round((dayStart(now) - dayStart(at)) / DAY_MS);
  if (days <= 0) return at.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  if (days === 1) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-1, "day");
  return at.toLocaleDateString(locale, { month: "numeric", day: "numeric" });
};
