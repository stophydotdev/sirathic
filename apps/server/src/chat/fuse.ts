const RRF_K = 60;

export const fuse = <Item>(lists: Item[][], keyOf: (item: Item) => string) => {
  const scored = new Map<string, { item: Item; score: number }>();
  for (const list of lists) {
    list.forEach((item, rank) => {
      const key = keyOf(item);
      const found = scored.get(key);
      scored.set(key, {
        item: found?.item ?? item,
        score: (found?.score ?? 0) + 1 / (RRF_K + rank + 1),
      });
    });
  }
  return [...scored.values()].toSorted((a, b) => b.score - a.score).map(({ item }) => item);
};
