import { db } from "@sirathic/db";
import { settings as settingsTable } from "@sirathic/db/schema";
import { eq, sql } from "drizzle-orm";
import type { z } from "zod";
import {
  DEFAULT_SETTINGS,
  rememberedUpdate,
  type Settings,
  settings,
  type settingsUpdate,
  type told,
} from "../shared/settings";

const stored = settings
  .partial()
  .catch({})
  .transform((saved): Settings => ({ ...DEFAULT_SETTINGS, ...saved }));

export async function getSettings(owner: string) {
  const [row] = await db
    .select({ values: settingsTable.values })
    .from(settingsTable)
    .where(eq(settingsTable.owner, owner));
  return stored.parse(row?.values);
}

export async function updateSettings(owner: string, update: z.output<typeof settingsUpdate>) {
  const [row] = await db
    .insert(settingsTable)
    .values({ owner, values: update })
    .onConflictDoUpdate({
      target: settingsTable.owner,
      set: {
        values: sql`${settingsTable.values} || excluded."values"`,
        updatedAt: new Date(),
      },
    })
    .returning({ values: settingsTable.values });
  return stored.parse(row?.values);
}

export async function remember(owner: string, input: z.output<typeof told>) {
  const { memory } = await getSettings(owner);
  const update = rememberedUpdate(memory, input);
  if (Object.keys(update).length > 0) await updateSettings(owner, update);
  return update;
}
