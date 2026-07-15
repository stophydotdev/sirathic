import { sql } from "drizzle-orm"
import { customType, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector"
  },
})

export const sourceTypeEnum = pgEnum("source_type", ["quran", "hadith", "tafsir", "fatwa", "athar"])
export const tierEnum = pgEnum("tier", ["A", "B", "C"])
export const madhhabEnum = pgEnum("madhhab", ["hanafi", "shafii", "maliki", "hanbali", "shia", "cross"])
export const gradeEnum = pgEnum("grade", ["sahih", "hasan", "daif", "mawdu"])

export const corpus = pgTable(
  "corpus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceType: sourceTypeEnum("source_type").notNull(),
    sourceDomain: text("source_domain").notNull(),
    tier: tierEnum("tier").notNull(),
    madhhab: madhhabEnum("madhhab").notNull().default("cross"),
    ref: text("ref").notNull(),
    lang: text("lang").notNull(),
    title: text("title"),
    text: text("text").notNull(),
    grade: gradeEnum("grade"),
    narrator: text("narrator"),
    url: text("url").notNull(),
    contentHash: text("content_hash").notNull(),
    search: tsvector("search").generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(title, '') || ' ' || text)`,
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("corpus_source_ref_lang_uniq").on(t.sourceDomain, t.ref, t.lang),
    index("corpus_search_idx").using("gin", t.search),
    index("corpus_ref_idx").on(t.ref),
    index("corpus_filter_idx").on(t.sourceType, t.tier, t.madhhab),
    index("corpus_grade_idx").on(t.grade),
  ],
)

export type CorpusRow = typeof corpus.$inferSelect
export type NewCorpusRow = typeof corpus.$inferInsert
