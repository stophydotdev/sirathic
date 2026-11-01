import { db } from "@sirathic/db";
import { hadithGrades, hadiths, sources, texts } from "@sirathic/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { hadithLink, OUR_LETTERED } from "./hadithLinks";
import { trustedHadith } from "./trustedHadith";

const LICENSED = "hadeethenc-en";
const MACHINE_TRANSLATED = "sirathic-en";

export const citableId = (hadith: { id: string; book: string; arabicNumber: string | null }) =>
  hadith.book === "ahmad" && hadith.arabicNumber ? `ahmad:${hadith.arabicNumber}` : hadith.id;

export const hadithsByIds = async (asked: string[]) => {
  if (asked.length === 0) return [];
  const ids = asked.map((id) => OUR_LETTERED.get(id) ?? id);
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
      .where(and(inArray(hadiths.id, ids), trustedHadith.where)),
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
      .where(and(inArray(texts.ref, ids), inArray(texts.source, [LICENSED, MACHINE_TRANSLATED]))),
  ]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    if (row === undefined) return [];
    const { url, ...hadith } = row;
    const bodyOf = (source: string, kind: (typeof english)[number]["kind"]) =>
      english.find((text) => text.ref === id && text.source === source && text.kind === kind)
        ?.body ?? null;
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
