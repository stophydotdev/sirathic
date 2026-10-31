export const mapLimit = async <Item, Result>(
  items: readonly Item[],
  limit: number,
  run: (item: Item, index: number) => Promise<Result>,
) => {
  const results: Result[] = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    const index = next++;
    const item = items[index];
    if (item === undefined) return;
    results[index] = await run(item, index);
    return worker();
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

export const groupBy = <Item, Key>(items: readonly Item[], keyOf: (item: Item) => Key) => {
  const groups = new Map<Key, Item[]>();
  for (const item of items) groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item]);
  return groups;
};
