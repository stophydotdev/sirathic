import { db } from "@sirathic/db";
import { hadithGrades, hadiths, sources, texts } from "@sirathic/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { hadithLink } from "./hadithLinks";

const LICENSED = "hadeethenc-en";
const MACHINE_TRANSLATED = "sirathic-en";

export const hadithGetInput = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(20),
});

export const hadithsByIds = async (ids: string[]) => {
  if (ids.length === 0) return [];
  const [rows, grades, english] = await Promise.all([
    db
      .select({
        id: hadiths.id,
        book: hadiths.book,
        chapter: hadiths.chapterEn,
        arabicNumber: hadiths.arabicNumber,
        textAr: hadiths.textAr,
        url: hadiths.url,
        credit: sources.credit,
      })
      .from(hadiths)
      .leftJoin(sources, eq(sources.name, hadiths.source))
      .where(inArray(hadiths.id, ids)),
    db
      .select({
        hadithId: hadithGrades.hadithId,
        grader: hadithGrades.grader,
        grade: hadithGrades.grade,
      })
      .from(hadithGrades)
      .where(inArray(hadithGrades.hadithId, ids)),
    db
      .select({
        ref: texts.ref,
        source: texts.source,
        kind: texts.kind,
        body: texts.body,
      })
      .from(texts)
      .where(
        and(
          inArray(texts.ref, ids),
          inArray(texts.source, [LICENSED, MACHINE_TRANSLATED]),
        ),
      ),
  ]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    if (row === undefined) return [];
    const { url, ...hadith } = row;
    const bodyOf = (source: string, kind: (typeof english)[number]["kind"]) =>
      english.find(
        (text) =>
          text.ref === id && text.source === source && text.kind === kind,
      )?.body ?? null;
    const licensedEnglish = bodyOf(LICENSED, "translation");
    return [
      {
        ...hadith,
        english: licensedEnglish ?? bodyOf(MACHINE_TRANSLATED, "translation"),
        licensedEnglish,
        explanation: bodyOf(LICENSED, "explanation"),
        grades: grades
          .filter((grade) => grade.hadithId === id)
          .map(({ grader, grade }) => ({ grader, grade })),
        link: hadithLink(id, url),
      },
    ];
  });
};

const byArnautNumber = async (ids: string[]) => {
  const numbers = ids.flatMap((id) => {
    const [book, number] = id.split(":");
    return book === "ahmad" && number ? [number] : [];
  });
  if (numbers.length === 0) return new Map<string, string>();
  const rows = await db
    .select({ id: hadiths.id, arabicNumber: hadiths.arabicNumber })
    .from(hadiths)
    .where(
      and(eq(hadiths.book, "ahmad"), inArray(hadiths.arabicNumber, numbers)),
    );
  return new Map(rows.map((row) => [`ahmad:${row.arabicNumber}`, row.id]));
};

export const hadithGet = async (input: z.input<typeof hadithGetInput>) => {
  const { ids: requested } = hadithGetInput.parse(input);
  const arnaut = await byArnautNumber(requested);
  const ids = requested.map((id) => arnaut.get(id) ?? id);
  const exact = await hadithsByIds(ids);
  const exactIds = new Set(exact.map((hadith) => hadith.id));
  const firstVariants = await hadithsByIds(
    ids
      .filter((id) => !exactIds.has(id) && /\d$/u.test(id))
      .map((id) => `${id}a`),
  );
  const byId = new Map(
    [...exact, ...firstVariants].map((hadith) => [hadith.id, hadith]),
  );
  return {
    hadiths: ids.flatMap((id) => byId.get(id) ?? byId.get(`${id}a`) ?? []),
    missing: ids.filter((id) => !byId.has(id) && !byId.has(`${id}a`)),
  };
};
