type Grouped = { name: string; pinned: boolean; section: string | null; hidden: boolean };

type BotGroup<Bot> =
  | { kind: "pinned"; bots: Bot[] }
  | { kind: "section"; name: string; bots: Bot[] }
  | { kind: "loose"; bots: Bot[] };

export const SIDEBAR_LIMIT = 6;

export const botLabel = (bot: { name: string; title: string }) =>
  bot.title ? `${bot.name} · ${bot.title}` : bot.name;

export const sectionNames = (bots: Grouped[]) =>
  [...new Set(bots.flatMap((bot) => (bot.section ? [bot.section] : [])))].toSorted((a, b) =>
    a.localeCompare(b),
  );

export function botGroups<Bot extends Grouped>(bots: Bot[], limit: number) {
  const shown = bots.filter((bot) => !bot.hidden);
  const rest = shown.filter((bot) => !bot.pinned);
  const names = sectionNames(rest);
  const ordered = [
    ...names.flatMap((name) => rest.filter((bot) => bot.section === name)),
    ...rest.filter((bot) => !bot.section),
  ];
  const kept = new Set(ordered.slice(0, limit));
  const groups: BotGroup<Bot>[] = [
    { kind: "pinned", bots: shown.filter((bot) => bot.pinned) },
    ...names.map((name) => ({
      kind: "section" as const,
      name,
      bots: rest.filter((bot) => bot.section === name && kept.has(bot)),
    })),
    { kind: "loose", bots: rest.filter((bot) => !bot.section && kept.has(bot)) },
  ];
  return {
    groups: groups.filter((group) => group.bots.length > 0),
    more: ordered.length - kept.size,
    hidden: bots.filter((bot) => bot.hidden),
  };
}
