import { mkdir } from "node:fs/promises";
import { db } from "@sirathic/db";
import {
  duas,
  hadithGrades,
  hadiths,
  sources,
  texts,
} from "@sirathic/db/schema";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { DATA_DIR, HADITH_ENGLISH_SOURCE } from "./catalog";

const DIR = `${DATA_DIR}/corrections`;
const FILE = `${DIR}/corrections.json`;
const ADDED_SOURCE = "sunnah-com";
const ARNAUT = "Shu'ayb al-Arna'ut";
const CHUNK_SIZE = 500;

const hadithRow = z.object({
  id: z.string(),
  book: z.string(),
  number: z.number(),
  arabicNumber: z.string().nullable(),
  chapter: z.number(),
  chapterEn: z.string().nullable(),
  textAr: z.string().nullable(),
  textArClean: z.string().nullable(),
  url: z.string().nullable(),
});
const corrections = z.object({
  source: z.object({
    name: z.string(),
    url: z.string(),
    version: z.string(),
    license: z.string(),
    credit: z.string().nullable(),
  }),
  replacedBooks: z.array(z.string()),
  added: z.array(hadithRow),
  arabic: z.array(
    z.object({ id: z.string(), textAr: z.string(), textArClean: z.string() }),
  ),
  arnautNumbers: z.array(z.object({ id: z.string(), number: z.string() })),
  grades: z.array(
    z.object({ hadithId: z.string(), grader: z.string(), grade: z.string() }),
  ),
  licensedEnglish: z.array(
    z.object({
      ref: z.string(),
      kind: z.enum(["translation", "explanation"]),
      body: z.string(),
    }),
  ),
  searchEnglish: z.array(z.string()),
  duaLinks: z.array(
    z.object({ id: z.string(), hadithId: z.string().nullable() }),
  ),
});
type Corrections = z.infer<typeof corrections>;

const ids = (list: string[]) =>
  sql.raw(
    `(${list.map((id) => `'${id.replaceAll("'", "''")}'`).join(",") || "''"})`,
  );

const chunks = <Row>(rows: Row[]) =>
  Array.from({ length: Math.ceil(rows.length / CHUNK_SIZE) }, (_, index) =>
    rows.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
  );

const exportCorrections = async () => {
  const [source] = await db
    .select()
    .from(sources)
    .where(eq(sources.name, ADDED_SOURCE));
  if (!source) throw new Error(`no ${ADDED_SOURCE} source row to export`);
  const listed = await Bun.file(`${DIR}/lists.json`)
    .json()
    .catch(() => ({ arabic: [], grades: [], searchEnglish: [] }));
  const {
    arabic: arabicIds,
    grades: gradeIds,
    searchEnglish,
  } = z
    .object({
      arabic: z.array(z.string()),
      grades: z.array(z.string()),
      searchEnglish: z.array(z.string()),
    })
    .parse(listed);
  const added = await db
    .select({
      id: hadiths.id,
      book: hadiths.book,
      number: hadiths.number,
      arabicNumber: hadiths.arabicNumber,
      chapter: hadiths.chapter,
      chapterEn: hadiths.chapterEn,
      textAr: hadiths.textAr,
      textArClean: hadiths.textArClean,
      url: hadiths.url,
    })
    .from(hadiths)
    .where(eq(hadiths.source, ADDED_SOURCE));
  const data: Corrections = {
    source: {
      name: source.name,
      url: source.url,
      version: source.version,
      license: source.license,
      credit: source.credit,
    },
    replacedBooks: ["riyadussalihin"],
    added,
    arabic: arabicIds.length
      ? (
          await db
            .select({
              id: hadiths.id,
              textAr: hadiths.textAr,
              textArClean: hadiths.textArClean,
            })
            .from(hadiths)
            .where(inArray(hadiths.id, arabicIds))
        ).flatMap((r) =>
          r.textAr && r.textArClean
            ? [{ id: r.id, textAr: r.textAr, textArClean: r.textArClean }]
            : [],
        )
      : [],
    arnautNumbers: (
      await db
        .select({ id: hadiths.id, number: hadiths.arabicNumber })
        .from(hadiths)
        .where(and(eq(hadiths.book, "ahmad"), isNotNull(hadiths.arabicNumber)))
    ).flatMap((r) => (r.number ? [{ id: r.id, number: r.number }] : [])),
    grades: [
      ...(await db
        .select()
        .from(hadithGrades)
        .where(eq(hadithGrades.grader, ARNAUT))),
      ...(
        await db
          .select()
          .from(hadithGrades)
          .where(
            inArray(hadithGrades.hadithId, [
              ...gradeIds,
              ...added.map((r) => r.id),
            ]),
          )
      ).filter((g) => g.grader !== ARNAUT),
    ],
    licensedEnglish: (
      await db
        .select({ ref: texts.ref, kind: texts.kind, body: texts.body })
        .from(texts)
        .where(eq(texts.source, "hadeethenc-en"))
    ).flatMap((r) =>
      r.kind === "tafsir" ? [] : [{ ref: r.ref, kind: r.kind, body: r.body }],
    ),
    searchEnglish,
    duaLinks: await db
      .select({ id: duas.id, hadithId: duas.hadithId })
      .from(duas),
  };
  await mkdir(DIR, { recursive: true });
  await Bun.write(FILE, JSON.stringify(data));
  console.log(
    `exported: ${data.added.length} added hadiths, ${data.arabic.length} Arabic fixes, ${data.arnautNumbers.length} Arna'ut numbers, ${data.grades.length} grades, ${data.licensedEnglish.length} HadeethEnc texts, ${data.searchEnglish.length} search texts, ${data.duaLinks.length} dua links`,
  );
};

const applyCorrections = async (dryRun: boolean) => {
  const data = corrections.parse(await Bun.file(FILE).json());
  const changed: Record<string, number> = {};
  const count = (key: string, result: { count?: number; length: number }) => {
    changed[key] = (changed[key] ?? 0) + (result.count ?? result.length);
  };
  let finished = false;
  const run = db.transaction(async (tx) => {
    await tx.insert(sources).values(data.source).onConflictDoNothing();
    const stale = (
      await tx
        .select({ id: hadiths.id })
        .from(hadiths)
        .where(
          and(
            inArray(hadiths.book, data.replacedBooks),
            sql`${hadiths.source} <> ${ADDED_SOURCE}`,
          ),
        )
    ).map((r) => r.id);
    await Promise.all(
      chunks(stale).map(async (chunk) => {
        await tx
          .delete(hadithGrades)
          .where(inArray(hadithGrades.hadithId, chunk));
        await tx
          .update(duas)
          .set({ hadithId: null })
          .where(inArray(duas.hadithId, chunk));
        count(
          "old rows of replaced books removed",
          await tx
            .delete(hadiths)
            .where(inArray(hadiths.id, chunk))
            .returning({ id: hadiths.id }),
        );
      }),
    );
    const present = new Set(
      (
        await tx
          .select({ id: hadiths.id })
          .from(hadiths)
          .where(eq(hadiths.source, ADDED_SOURCE))
      ).map((r) => r.id),
    );
    await Promise.all(
      chunks(data.added.filter((r) => !present.has(r.id))).map(async (chunk) =>
        count(
          "added hadiths inserted",
          await tx
            .insert(hadiths)
            .values(chunk.map((r) => ({ ...r, source: ADDED_SOURCE })))
            .returning({ id: hadiths.id }),
        ),
      ),
    );
    await Promise.all(
      data.arabic.map(async (fix) =>
        count(
          "Arabic fixes applied",
          await tx
            .update(hadiths)
            .set({
              textAr: fix.textAr,
              textArClean: fix.textArClean,
              embedding: null,
            })
            .where(
              and(
                eq(hadiths.id, fix.id),
                sql`${hadiths.textAr} is distinct from ${fix.textAr}`,
              ),
            )
            .returning({ id: hadiths.id }),
        ),
      ),
    );
    await Promise.all(
      chunks(data.arnautNumbers).map(async (chunk) =>
        count(
          "Arna'ut numbers set",
          await tx.execute(
            sql`update ${hadiths} h set arabic_number = v.n from (values ${sql.join(
              chunk.map((r) => sql`(${r.id}, ${r.number})`),
              sql`, `,
            )}) as v(id, n) where h.id = v.id and h.arabic_number is distinct from v.n`,
          ),
        ),
      ),
    );
    const existing = new Set(
      (
        await tx.execute(
          sql`select hadith_id, grader, grade from ${hadithGrades} where hadith_id in ${ids([...new Set(data.grades.map((g) => g.hadithId))])}`,
        )
      ).map((g) => `${g.hadith_id}|${g.grader}|${g.grade}`),
    );
    const wanted = data.grades.filter(
      (g) => !existing.has(`${g.hadithId}|${g.grader}|${g.grade}`),
    );
    await Promise.all(
      chunks(wanted).map(async (chunk) => {
        await tx.execute(
          sql`delete from ${hadithGrades} g using (values ${sql.join(
            chunk.map((g) => sql`(${g.hadithId}, ${g.grader})`),
            sql`, `,
          )}) as v(id, grader) where g.hadith_id = v.id and g.grader = v.grader`,
        );
        count(
          "grades written",
          await tx
            .insert(hadithGrades)
            .values(chunk)
            .returning({ id: hadithGrades.hadithId }),
        );
      }),
    );
    const licensed = new Set(
      (
        await tx
          .select({ ref: texts.ref, kind: texts.kind, body: texts.body })
          .from(texts)
          .where(eq(texts.source, "hadeethenc-en"))
      ).map((t) => `${t.ref}|${t.kind}|${t.body}`),
    );
    const target = data.licensedEnglish.map(
      (t) => `${t.ref}|${t.kind}|${t.body}`,
    );
    if (
      licensed.size !== target.length ||
      target.some((t) => !licensed.has(t))
    ) {
      await tx.delete(texts).where(eq(texts.source, "hadeethenc-en"));
      await Promise.all(
        chunks(data.licensedEnglish).map(async (chunk) =>
          count(
            "HadeethEnc texts placed",
            await tx
              .insert(texts)
              .values(
                chunk.map((t) => ({
                  ...t,
                  source: "hadeethenc-en",
                  lang: "en" as const,
                })),
              )
              .returning({ ref: texts.ref }),
          ),
        ),
      );
    }
    await Promise.all(
      chunks(data.searchEnglish).map(async (chunk) =>
        count(
          "search texts set to our translation",
          await tx.execute(
            sql`update ${hadiths} h set text_en = t.body, embedding = null from ${texts} t where t.ref = h.id and t.source = ${HADITH_ENGLISH_SOURCE} and t.kind = 'translation' and h.id in ${ids(chunk)} and h.text_en is distinct from t.body`,
          ),
        ),
      ),
    );
    count(
      "empty search texts filled",
      await tx.execute(
        sql`update ${hadiths} h set text_en = t.body, embedding = null from ${texts} t where t.ref = h.id and t.source = ${HADITH_ENGLISH_SOURCE} and t.kind = 'translation' and h.text_en is null`,
      ),
    );
    await Promise.all(
      data.duaLinks.map(async (link) =>
        count(
          "dua links set",
          await tx
            .update(duas)
            .set({ hadithId: link.hadithId })
            .where(
              and(
                eq(duas.id, link.id),
                sql`${duas.hadithId} is distinct from ${link.hadithId}`,
              ),
            )
            .returning({ id: duas.id }),
        ),
      ),
    );
    console.log(
      Object.entries(changed)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${k}: ${n}`)
        .join("\n") || "nothing to change",
    );
    finished = true;
    if (dryRun) tx.rollback();
  });
  await (dryRun
    ? run.catch(() => {
        if (!finished) throw new Error("the dry run failed before it finished");
        console.log("dry run: rolled back");
      })
    : run);
};

if (process.argv.includes("--export")) await exportCorrections();
else await applyCorrections(process.argv.includes("--dry-run"));
await db.$client.end();
