import { mkdirSync, statSync } from "node:fs";
import { dirname, extname } from "node:path";

const contentTypes = {
  ".json": "application/json; charset=utf-8",
  ".sqlite": "application/vnd.sqlite3",
} as const;

export const contentTypeOf = (key: string) =>
  extname(key) === ".sqlite" ? contentTypes[".sqlite"] : contentTypes[".json"];

export const createOutput = (dir: string) => {
  const keys = new Set<string>();
  const path = (key: string) => {
    mkdirSync(dirname(`${dir}/${key}`), { recursive: true });
    keys.add(key);
    return `${dir}/${key}`;
  };
  return {
    dir,
    keys,
    path,
    json: <Value>(key: string, value: Value) => Bun.write(path(key), JSON.stringify(value)),
    size: (key: string) => statSync(`${dir}/${key}`).size,
  };
};

export type Output = ReturnType<typeof createOutput>;
