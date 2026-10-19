import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  foreignKey,
  halfvec,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

export const EMBEDDING = {
  model: "text-embedding-3-small",
  dimensions: 1536,
  dollarsPerMillionTokens: 0.02,
} as const;

export const surahs = pgTable("surahs", {
  number: smallint().primaryKey(),
  nameAr: text().notNull(),
  nameEn: text().notNull(),
  nameTranslit: text().notNull(),
  revelation: text({ enum: ["meccan", "medinan"] }).notNull(),
  verseCount: smallint().notNull(),
});

export const verses = pgTable(
  "verses",
  {
    id: text().primaryKey(),
    surah: smallint()
      .notNull()
      .references(() => surahs.number),
    ayah: smallint().notNull(),
    juz: smallint().notNull(),
    page: smallint().notNull(),
    textAr: text().notNull(),
    textArClean: text().notNull(),
    textEn: text().notNull(),
    footnotesEn: text(),
    search: tsvector().generatedAlwaysAs(
      sql`to_tsvector('english', text_en) || to_tsvector('simple', text_ar_clean)`,
    ),
    embedding: halfvec({ dimensions: EMBEDDING.dimensions }),
  },
  (table) => [
    index("verses_search").using("gin", table.search),
    index("verses_embedding").using(
      "hnsw",
      table.embedding.op("halfvec_cosine_ops"),
    ),
  ],
);

export const hadiths = pgTable(
  "hadiths",
  {
    id: text().primaryKey(),
    book: text().notNull(),
    number: numeric({ mode: "number" }).notNull(),
    arabicNumber: text(),
    chapter: smallint().notNull(),
    chapterEn: text(),
    textAr: text(),
    textArClean: text(),
    textEn: text(),
    source: text()
      .notNull()
      .references(() => sources.name),
    url: text(),
    search: tsvector().generatedAlwaysAs(
      sql`to_tsvector('english', coalesce(text_en, '')) || to_tsvector('simple', coalesce(text_ar_clean, ''))`,
    ),
    embedding: halfvec({ dimensions: EMBEDDING.dimensions }),
  },
  (table) => [
    check(
      "hadiths_has_text",
      sql`${table.textAr} is not null or ${table.textEn} is not null`,
    ),
    index("hadiths_search").using("gin", table.search),
    index("hadiths_embedding").using(
      "hnsw",
      table.embedding.op("halfvec_cosine_ops"),
    ),
  ],
);

export const hadithGrades = pgTable(
  "hadith_grades",
  {
    hadithId: text()
      .notNull()
      .references(() => hadiths.id),
    grader: text().notNull(),
    grade: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.hadithId, table.grader] })],
);

const fiqhSchool = () =>
  text({
    enum: ["hanafi", "maliki", "shafii", "hanbali", "comparative"],
  }).notNull();

export const fiqhWorks = pgTable("fiqh_works", {
  id: text().primaryKey(),
  titleAr: text().notNull(),
  titleLat: text().notNull(),
  authorAr: text().notNull(),
  deathYearAh: smallint().notNull(),
  school: fiqhSchool(),
  source: text().notNull(),
});

export const fiqhPassages = pgTable(
  "fiqh_passages",
  {
    id: text().primaryKey(),
    workId: text()
      .notNull()
      .references(() => fiqhWorks.id),
    school: fiqhSchool(),
    volume: smallint().notNull(),
    page: integer().notNull(),
    heading: text(),
    textAr: text().notNull(),
    textArClean: text().notNull(),
    search: tsvector().generatedAlwaysAs(
      sql`to_tsvector('simple', text_ar_clean)`,
    ),
    embedding: halfvec({ dimensions: EMBEDDING.dimensions }),
  },
  (table) => [
    index("fiqh_passages_search").using("gin", table.search),
    index("fiqh_passages_embedding").using(
      "hnsw",
      table.embedding.op("halfvec_cosine_ops"),
    ),
  ],
);

export const duas = pgTable(
  "duas",
  {
    id: text().primaryKey(),
    title: text().notNull(),
    occasions: text().array().notNull(),
    textAr: text().notNull(),
    textArClean: text().notNull(),
    textEn: text().notNull(),
    explanation: text().notNull(),
    attribution: text().notNull(),
    grade: text().notNull(),
    hadithId: text().references(() => hadiths.id),
    search: tsvector().generatedAlwaysAs(
      sql`to_tsvector('english', title || ' ' || text_en) || to_tsvector('simple', text_ar_clean)`,
    ),
    embedding: halfvec({ dimensions: EMBEDDING.dimensions }),
  },
  (table) => [
    index("duas_search").using("gin", table.search),
    index("duas_embedding").using(
      "hnsw",
      table.embedding.op("halfvec_cosine_ops"),
    ),
  ],
);

export const sources = pgTable("sources", {
  name: text().primaryKey(),
  url: text().notNull(),
  version: text().notNull(),
  license: text().notNull(),
  credit: text(),
  importedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const fatwas = pgTable(
  "fatwas",
  {
    id: text().primaryKey(),
    source: text()
      .notNull()
      .references(() => sources.name),
    url: text().notNull(),
    school: text({ enum: ["hanafi", "maliki", "shafii", "hanbali"] }),
    answeredBy: text(),
    title: text().notNull(),
    question: text(),
    summary: text(),
    answer: text().notNull(),
    publishedAt: timestamp({ withTimezone: true }),
    crawledAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    search: tsvector().generatedAlwaysAs(
      sql`to_tsvector('english', title || ' ' || coalesce(question, '') || ' ' || answer)`,
    ),
    embedding: halfvec({ dimensions: EMBEDDING.dimensions }),
  },
  (table) => [
    index("fatwas_search").using("gin", table.search),
    index("fatwas_embedding").using(
      "hnsw",
      table.embedding.op("halfvec_cosine_ops"),
    ),
  ],
);

export const tafsirPassages = pgTable(
  "tafsir_passages",
  {
    source: text()
      .notNull()
      .references(() => sources.name),
    surah: smallint()
      .notNull()
      .references(() => surahs.number),
    fromAyah: smallint().notNull(),
    toAyah: smallint().notNull(),
    lang: text({ enum: ["ar", "en"] }).notNull(),
    body: text().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.source, table.surah, table.fromAyah, table.toAyah],
    }),
  ],
);

export const TEXT_LANGUAGES = [
  "ar",
  "en",
  "fr",
  "es",
  "it",
  "ru",
  "tr",
  "az",
  "bs",
  "sr",
  "uz",
  "ky",
  "id",
  "tl",
  "zh",
  "ug",
  "ja",
  "vi",
  "th",
  "km",
  "fa",
  "ku",
  "ps",
  "hi",
  "bn",
  "te",
  "ml",
  "as",
  "ta",
  "si",
  "ff",
] as const;

export const texts = pgTable(
  "texts",
  {
    ref: text().notNull(),
    source: text()
      .notNull()
      .references(() => sources.name),
    kind: text({ enum: ["translation", "tafsir", "explanation"] }).notNull(),
    lang: text({ enum: TEXT_LANGUAGES }).notNull(),
    body: text().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.ref, table.source, table.kind, table.lang],
    }),
  ],
);

export const verseWords = pgTable(
  "verse_words",
  {
    surah: smallint().notNull(),
    ayah: smallint().notNull(),
    words: text().array().notNull(),
    transliteration: text().array(),
  },
  (table) => [primaryKey({ columns: [table.surah, table.ayah] })],
);

export const WORD_LANGUAGES = [
  "en",
  "ur",
  "hi",
  "bn",
  "id",
  "tr",
  "fa",
  "fr",
  "ta",
  "inh",
] as const;

export const wordMeanings = pgTable(
  "word_meanings",
  {
    surah: smallint().notNull(),
    ayah: smallint().notNull(),
    lang: text({ enum: WORD_LANGUAGES }).notNull(),
    meanings: text().array().notNull(),
  },
  (table) => [primaryKey({ columns: [table.surah, table.ayah, table.lang] })],
);

export const translations = pgTable("translations", {
  id: smallint().primaryKey(),
  name: text().notNull(),
  lang: text().notNull(),
  kind: text({ enum: ["translation", "transliteration"] }).notNull(),
});

export const verseTranslations = pgTable(
  "verse_translations",
  {
    translation: smallint().notNull(),
    surah: smallint().notNull(),
    ayah: smallint().notNull(),
    text: text().notNull(),
    footnotes: text().array(),
  },
  (table) => [
    primaryKey({ columns: [table.translation, table.surah, table.ayah] }),
  ],
);

export const tafsirs = pgTable("tafsirs", {
  id: smallint().primaryKey(),
  name: text().notNull(),
  lang: text().notNull(),
  author: text().notNull(),
});

export const tafsirTexts = pgTable(
  "tafsir_texts",
  {
    tafsir: smallint().notNull(),
    surah: smallint().notNull(),
    fromAyah: smallint().notNull(),
    toAyah: smallint().notNull(),
    body: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tafsir, table.surah, table.fromAyah] }),
  ],
);

export const tafsirClassical = pgTable(
  "tafsir_classical",
  {
    work: text().notNull(),
    surah: smallint().notNull(),
    fromAyah: smallint().notNull(),
    toAyah: smallint().notNull(),
    body: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.work, table.surah, table.fromAyah] }),
  ],
);

export const recitationTimings = pgTable(
  "recitation_timings",
  {
    recitation: smallint().notNull(),
    surah: smallint().notNull(),
    ayah: smallint().notNull(),
    segments: jsonb()
      .$type<[word: number, start: number, end: number][]>()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.recitation, table.surah, table.ayah] }),
  ],
);

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid().primaryKey(),
    owner: text().notNull(),
    title: text().notNull(),
    messages: jsonb().notNull(),
    pinned: boolean().notNull().default(false),
    unread: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("chat_sessions_owner_updated").on(table.owner, table.updatedAt),
  ],
);

export const settings = pgTable("settings", {
  owner: text().primaryKey(),
  values: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const users = pgTable("users", {
  id: text().primaryKey(),
  email: text(),
  plan: text(),
  accountId: text().notNull(),
  tokens: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const loginSessions = pgTable(
  "login_sessions",
  {
    id: text().primaryKey(),
    userId: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("login_sessions_user").on(table.userId),
    foreignKey({
      name: "login_sessions_user_id_fkey",
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
  ],
);

export const events = pgTable(
  "events",
  {
    id: uuid().primaryKey(),
    name: text().notNull(),
    owner: text(),
    props: jsonb().notNull(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("events_name_at").on(table.name, table.at)],
);
