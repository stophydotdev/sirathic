import { z } from "zod";

const STORAGE_KEY = "sirathicLastRead";

const lastRead = z.object({
  surah: z.number(),
  ayah: z.number(),
  name: z.string(),
});

export type LastRead = z.output<typeof lastRead>;

export function readLastRead() {
  const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
  return raw ? lastRead.safeParse(JSON.parse(raw)).data : undefined;
}

export function saveLastRead(position: LastRead) {
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(position));
}
