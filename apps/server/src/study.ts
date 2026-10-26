import { hadithsByIds } from "@sirathic/core/tools/hadithGet";
import { quranGet } from "@sirathic/core/tools/quranGet";
import { db } from "@sirathic/db";
import { botItems } from "@sirathic/db/schema";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { z } from "zod";
import type { BotScope } from "./chat/botTools";
import { hadithTitle } from "./chat/cite";

const REVIEW_DAYS = [1, 3, 7, 14, 30] as const;

const DAY_MS = 86_400_000;

export const isMemorized = (step: number) => step >= REVIEW_DAYS.length;

export const afterReview = (step: number, right: boolean, now: Date) => {
  const next = right ? Math.min(step + 1, REVIEW_DAYS.length) : 0;
  const days = REVIEW_DAYS[Math.min(next, REVIEW_DAYS.length - 1)] ?? 1;
  return { step: next, dueAt: new Date(now.getTime() + days * DAY_MS) };
};

const itemKey = z.object({
  kind: z.enum(["verse", "hadith", "word", "other"]),
  ref: z.string().trim().min(1).max(200),
});

export const addInput = itemKey.extend({
  label: z.string().trim().min(1).max(200).optional(),
});

export const gradeInput = itemKey.extend({
  right: z.boolean(),
  mistake: z.string().trim().min(1).max(300).optional(),
});

const verseRange = z
  .string()
  .regex(/^\d{1,3}:\d{1,3}(?:-\d{1,3})?$/, "A verse ref looks like 112:1-4 or 2:255.")
  .transform((ref) => {
    const [surah, from, to = from] = ref.split(/[:-]/).map(Number);
    return { surah, from, to };
  })
  .pipe(
    z
      .object({
        surah: z.number().int().min(1).max(114),
        from: z.number().int().min(1),
        to: z.number().int().min(1),
      })
      .refine(({ from, to }) => to >= from, "A verse range cannot end before it starts."),
  );

async function sourceOf({ kind, ref, label }: z.output<typeof addInput>) {
  switch (kind) {
    case "verse": {
      const range = verseRange.parse(ref);
      const { verses } = await quranGet(range);
      const [first] = verses;
      if (!first || verses.length !== range.to - range.from + 1) {
        throw new Error(`Quran ${ref} was not found.`);
      }
      const span = range.from === range.to ? `${range.from}` : `${range.from}-${range.to}`;
      return {
        ref: `${range.surah}:${span}`,
        label: `${first.surahName} ${range.surah}:${span}`,
      };
    }
    case "hadith": {
      const [hadith] = await hadithsByIds([ref]);
      if (!hadith) throw new Error(`Hadith ${ref} was not found. Find it with search first.`);
      return { ref: hadith.id, label: hadithTitle(hadith) };
    }
    case "word":
    case "other": {
      if (!label) throw new Error("A word or other item needs a label.");
      return { ref, label };
    }
  }
}

export async function addItem({ id, owner }: BotScope, input: z.output<typeof addInput>) {
  const { ref, label } = await sourceOf(input);
  const dueAt = afterReview(0, false, new Date()).dueAt;
  const [added] = await db
    .insert(botItems)
    .values({ owner, botId: id, kind: input.kind, ref, label, dueAt })
    .onConflictDoNothing()
    .returning({ label: botItems.label });
  return { added: added !== undefined, label, ref };
}

export const dueItems = ({ id, owner }: BotScope, limit: number) =>
  db
    .select({
      kind: botItems.kind,
      ref: botItems.ref,
      label: botItems.label,
      step: botItems.step,
      mistake: botItems.mistake,
    })
    .from(botItems)
    .where(and(eq(botItems.owner, owner), eq(botItems.botId, id), lte(botItems.dueAt, new Date())))
    .orderBy(asc(botItems.dueAt))
    .limit(limit);

export async function gradeItem(
  { id, owner }: BotScope,
  { kind, ref, right, mistake }: z.output<typeof gradeInput>,
) {
  const where = and(
    eq(botItems.owner, owner),
    eq(botItems.botId, id),
    eq(botItems.kind, kind),
    eq(botItems.ref, ref),
  );
  const [item] = await db.select({ step: botItems.step }).from(botItems).where(where);
  if (!item) throw new Error(`No study item ${kind} ${ref}. Add it first.`);
  const next = afterReview(item.step, right, new Date());
  await db
    .update(botItems)
    .set({
      ...next,
      right: right ? sql`${botItems.right} + 1` : undefined,
      wrong: right ? undefined : sql`${botItems.wrong} + 1`,
      mistake: right ? undefined : (mistake ?? null),
    })
    .where(where);
  return { ...next, memorized: isMemorized(next.step) };
}

export async function progressOf({ id, owner }: BotScope) {
  const items = await db
    .select({ step: botItems.step, dueAt: botItems.dueAt })
    .from(botItems)
    .where(and(eq(botItems.owner, owner), eq(botItems.botId, id)));
  const now = new Date();
  const memorized = items.filter((item) => isMemorized(item.step)).length;
  return {
    memorized,
    learning: items.length - memorized,
    due: items.filter((item) => item.dueAt <= now).length,
  };
}
