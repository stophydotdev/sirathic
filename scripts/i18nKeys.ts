import { Glob } from "bun";

const WEB = new URL("../apps/web/", import.meta.url).pathname;
const CALL = /\bt(?:Now)?\(\s*("(?:[^"\\]|\\.)*")/gu;
const MARKED = /\}\s*(?:as const\s*)?satisfies\s+Record<[^;]*MessageKey>/gu;
const VALUE = /:\s*("(?:[^"\\]|\\.)*")/gu;

const objectBefore = (source: string, end: number) => {
  let depth = 0;
  for (let index = end; index >= 0; index--) {
    if (source[index] === "}") depth++;
    if (source[index] === "{" && --depth === 0) {
      return source.slice(index, end + 1);
    }
  }
  return "";
};

const keys = new Set<string>();
const files = [...new Glob("src/{app,components}/**/*.{ts,tsx}").scanSync({ cwd: WEB })].toSorted();
const sources = await Promise.all(files.map((file) => Bun.file(`${WEB}${file}`).text()));
for (const source of sources) {
  for (const [, literal = ""] of source.matchAll(CALL)) {
    keys.add(JSON.parse(literal));
  }
  for (const marked of source.matchAll(MARKED)) {
    const body = objectBefore(source, marked.index);
    for (const [, literal = ""] of body.matchAll(VALUE)) {
      keys.add(JSON.parse(literal));
    }
  }
}

const MISSING =
  /'((?:"(?:[^"\\]|\\.)*"(?: \| )?)+)' is not assignable to (?:parameter of )?type '(?:"|PlainKey|MessageKey)/gu;
const LITERAL = /"(?:[^"\\]|\\.)*"/gu;

const write = () =>
  Bun.write(
    `${WEB}src/messages/en.ts`,
    `export const MESSAGES = [\n${[...keys].map((key) => `  ${JSON.stringify(key)},`).join("\n")}\n] as const;\n\nexport type MessageKey = (typeof MESSAGES)[number];\n`,
  );

const settle = async (): Promise<void> => {
  await write();
  const checked = Bun.spawnSync(["bun", "run", "typecheck"], { cwd: WEB });
  const before = keys.size;
  for (const [, union = ""] of checked.stdout.toString().matchAll(MISSING)) {
    for (const [literal] of union.matchAll(LITERAL)) keys.add(JSON.parse(literal));
  }
  if (keys.size !== before) await settle();
};
await settle();
console.log(`${keys.size} keys in messages/en.ts`);
