import { fuse } from "./fuse";

const RATIO = 1.15;

const nearBest = <Item extends { distance: number }>(
  items: Item[],
  alwaysKept: (item: Item) => boolean = () => false,
) => {
  const best = Math.min(...items.map(({ distance }) => distance));
  return items.filter((item) => item.distance <= best * RATIO || alwaysKept(item));
};

export const nearFused = <Item extends { distance: number }>(
  lists: Item[][],
  keyOf: (item: Item) => string,
  alwaysKept?: (item: Item) => boolean,
) => {
  const near = fuse(
    lists.map((list) => nearBest(list, alwaysKept)),
    keyOf,
  );
  const kept = new Set(near.map(keyOf));
  return { near, far: fuse(lists, keyOf).filter((item) => !kept.has(keyOf(item))) };
};

export const withinChars = <Item>(items: Item[], sizeOf: (item: Item) => number, chars: number) => {
  let used = 0;
  const fits = items.filter((item, index) => {
    used += sizeOf(item);
    return index === 0 || used <= chars;
  });
  return { fits, over: items.filter((item) => !fits.includes(item)) };
};
