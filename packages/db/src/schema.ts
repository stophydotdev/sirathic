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
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const MARKED = "āīūḥḍṣṭẓĀĪŪḤḌṢṬẒأإآʿʾʼʻ";
export const UNMARKED = "aiuhdstzAIUHDSTZااا";

const unmarked = (english: string) => sql.raw(`translate(${english}, '${MARKED}', '${UNMARKED}')`);

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

export const EMBEDDING = {
  kind: "openai",
  model: "text-embedding-3-small",
  dimensions: 1536,
  dollarsPerMillionTokens: 0.02,
} as const;

export const BGE_M3 = {
  kind: "bgeM3",
  model: "@cf/baai/bge-m3",
  dimensions: 1024,
  dollarsPerMillionTokens: 0.012,
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
      sql`to_tsvector('english', ${unmarked("text_en")}) || to_tsvector('simple', ${unmarked("text_ar_clean")})`,
    ),
    embedding: halfvec({ dimensions: EMBEDDING.dimensions }),
  },
  (table) => [
    index("verses_search").using("gin", table.search),
    index("verses_embedding").using("hnsw", table.embedding.op("halfvec_cosine_ops")),
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
      sql`to_tsvector('english', ${unmarked("coalesce(text_en, '')")}) || to_tsvector('simple', ${unmarked("coalesce(text_ar_clean, '')")})`,
    ),
    embedding: halfvec({ dimensions: EMBEDDING.dimensions }),
  },
  (table) => [
    check("hadiths_has_text", sql`${table.textAr} is not null or ${table.textEn} is not null`),
    index("hadiths_search").using("gin", table.search),
    index("hadiths_embedding").using("hnsw", table.embedding.op("halfvec_cosine_ops")),
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
    search: tsvector().generatedAlwaysAs(sql`to_tsvector('simple', text_ar_clean)`),
    embeddingM3: halfvec("embedding_m3", { dimensions: BGE_M3.dimensions }),
  },
  (table) => [
    index("fiqh_passages_search").using("gin", table.search),
    index("fiqh_passages_embedding_m3").using("hnsw", table.embeddingM3.op("halfvec_cosine_ops")),
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
      sql`to_tsvector('english', ${unmarked("title || ' ' || text_en")}) || to_tsvector('simple', ${unmarked("text_ar_clean")})`,
    ),
    embedding: halfvec({ dimensions: EMBEDDING.dimensions }),
  },
  (table) => [
    index("duas_search").using("gin", table.search),
    index("duas_embedding").using("hnsw", table.embedding.op("halfvec_cosine_ops")),
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
    embeddingM3: halfvec("embedding_m3", { dimensions: BGE_M3.dimensions }),
  },
  (table) => [
    index("fatwas_search").using("gin", table.search),
    index("fatwas_embedding_m3").using("hnsw", table.embeddingM3.op("halfvec_cosine_ops")),
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

export const translations = pgTable("translations", {
  id: smallint().primaryKey(),
  name: text().notNull(),
  lang: text().notNull(),
  kind: text({ enum: ["translation", "transliteration"] }).notNull(),
});

export const projects = pgTable(
  "projects",
  {
    id: uuid().primaryKey().defaultRandom(),
    owner: text().notNull(),
    name: text().notNull(),
    icon: text(),
    instructions: text().notNull().default(""),
    projectOnlyMemory: boolean().notNull().default(false),
    memory: jsonb().$type<string[]>().notNull().default([]),
    kind: text().$type<"project" | "bot" | "group">().notNull().default("project"),
    members: jsonb().$type<string[]>(),
    color: text(),
    symbol: text(),
    plugins: jsonb().$type<string[]>(),
    title: text().notNull().default(""),
    pinned: boolean().notNull().default(false),
    section: text(),
    hidden: boolean().notNull().default(false),
    greeting: text(),
    question: text(),
    options: jsonb().$type<string[]>(),
    profile: jsonb()
      .$type<{ text: string; source: "said" | "guessed"; at: number }[]>()
      .notNull()
      .default([]),
    note: text().notNull().default(""),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    foreignKey({
      name: "projects_owner_fkey",
      columns: [table.owner],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
  ],
);

export const automations = pgTable(
  "automations",
  {
    id: uuid().primaryKey().defaultRandom(),
    owner: text().notNull(),
    projectId: uuid(),
    name: text().notNull(),
    prompt: text().notNull(),
    schedule: jsonb().notNull(),
    timezone: text().notNull(),
    enabled: boolean().notNull().default(true),
    nextRunAt: timestamp({ withTimezone: true }),
    lastRunAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    icon: text(),
    mode: text().notNull().default("quick"),
    notify: text().notNull().default("app"),
    failures: integer().notNull().default(0),
  },
  (table) => [
    index("automations_due")
      .on(table.nextRunAt)
      .where(sql`${table.enabled}`),
    index("automations_owner").on(table.owner),
    foreignKey({
      name: "automations_owner_fkey",
      columns: [table.owner],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "automations_project_id_fkey",
      columns: [table.projectId],
      foreignColumns: [projects.id],
    }).onDelete("cascade"),
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
    projectId: uuid(),
    automationId: uuid(),
    summary: text(),
    summarized: integer().notNull().default(0),
    publishedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("chat_sessions_owner_updated").on(table.owner, table.updatedAt),
    foreignKey({
      name: "chat_sessions_project_id_fkey",
      columns: [table.projectId],
      foreignColumns: [projects.id],
    }).onDelete("set null"),
    foreignKey({
      name: "chat_sessions_automation_id_fkey",
      columns: [table.automationId],
      foreignColumns: [automations.id],
    }).onDelete("set null"),
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
  name: text().notNull().default(""),
  email: text().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  plan: text(),
  accountId: text(),
  tokens: text(),
  staff: boolean().notNull().default(false),
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
    token: text().notNull().unique(),
    userId: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
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

export const accounts = pgTable(
  "accounts",
  {
    id: text().primaryKey(),
    userId: text().notNull(),
    providerId: text().notNull(),
    accountId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("accounts_user").on(table.userId),
    foreignKey({
      name: "accounts_user_id_fkey",
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
  ],
);

export const connections = pgTable(
  "connections",
  {
    owner: text().notNull(),
    connector: text().notNull(),
    name: text(),
    url: text(),
    secrets: text().notNull(),
    connected: boolean().notNull().default(false),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.owner, table.connector] }),
    foreignKey({
      name: "connections_owner_fkey",
      columns: [table.owner],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("verifications_identifier").on(table.identifier)],
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

export const skills = pgTable(
  "skills",
  {
    id: uuid().primaryKey().defaultRandom(),
    owner: text().notNull(),
    name: text().notNull(),
    instructions: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("skills_owner_name").on(table.owner, sql`lower(${table.name})`),
    foreignKey({
      name: "skills_owner_fkey",
      columns: [table.owner],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
  ],
);

export const files = pgTable(
  "files",
  {
    id: uuid().primaryKey().defaultRandom(),
    owner: text().notNull(),
    key: text().notNull(),
    name: text().notNull(),
    mediaType: text().notNull(),
    size: integer().notNull(),
    projectId: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("files_owner_created_at").on(table.owner, table.createdAt),
    index("files_project_id").on(table.projectId),
    foreignKey({
      name: "files_owner_fkey",
      columns: [table.owner],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "files_project_id_fkey",
      columns: [table.projectId],
      foreignColumns: [projects.id],
    }).onDelete("set null"),
  ],
);

export const botItems = pgTable(
  "bot_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    owner: text().notNull(),
    botId: uuid().notNull(),
    kind: text().$type<"verse" | "hadith" | "word" | "other">().notNull(),
    ref: text().notNull(),
    label: text().notNull(),
    step: smallint().notNull().default(0),
    dueAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    right: integer().notNull().default(0),
    wrong: integer().notNull().default(0),
    mistake: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("bot_items_bot_ref").on(table.botId, table.kind, table.ref),
    index("bot_items_bot_due").on(table.botId, table.dueAt),
    foreignKey({
      name: "bot_items_bot_id_fkey",
      columns: [table.botId],
      foreignColumns: [projects.id],
    }).onDelete("cascade"),
  ],
);

export const botNotes = pgTable(
  "bot_notes",
  {
    id: uuid().primaryKey().defaultRandom(),
    owner: text().notNull(),
    botId: uuid().notNull(),
    note: text().notNull(),
    reason: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("bot_notes_bot_created").on(table.botId, table.createdAt),
    foreignKey({
      name: "bot_notes_bot_id_fkey",
      columns: [table.botId],
      foreignColumns: [projects.id],
    }).onDelete("cascade"),
  ],
);

export const vaultLogins = pgTable(
  "vault_logins",
  {
    id: uuid().primaryKey().defaultRandom(),
    owner: text().notNull(),
    kind: text().$type<"login" | "contact">().notNull().default("login"),
    site: text().notNull(),
    sealed: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("vault_logins_owner_site").on(table.owner, table.site),
    foreignKey({
      name: "vault_logins_owner_fkey",
      columns: [table.owner],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
  ],
);
