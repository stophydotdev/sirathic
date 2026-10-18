import { hadithsByIds } from "@sirathic/core/tools/hadithGet";
import { db } from "@sirathic/db";
import {
  hadiths,
  recitationTimings,
  sources,
  surahs,
  type TEXT_LANGUAGES,
  tafsirPassages,
  tafsirs,
  tafsirTexts,
  texts,
  translations,
  verses,
  verseTranslations,
  verseWords,
  WORD_LANGUAGES,
  wordMeanings,
} from "@sirathic/db/schema";
import {
  and,
  asc,
  count,
  eq,
  gte,
  inArray,
  like,
  lte,
  max,
  min,
  or,
  sql,
} from "drizzle-orm";
import { StatusError } from "./respond";

const HADITHS_PER_PAGE = 40;
const MUYASSAR = "quranenc-arabic_moyassar";
const ABRIDGED = "quranenc-%mokhtasar";

const COLLECTION_NAMES = new Map([
  ["bukhari", { en: "Sahih al-Bukhari", ar: "صحيح البخاري" }],
  ["muslim", { en: "Sahih Muslim", ar: "صحيح مسلم" }],
  ["abudawud", { en: "Sunan Abi Dawud", ar: "سنن أبي داود" }],
  ["tirmidhi", { en: "Jami' at-Tirmidhi", ar: "جامع الترمذي" }],
  ["nasai", { en: "Sunan an-Nasa'i", ar: "سنن النسائي" }],
  ["ibnmajah", { en: "Sunan Ibn Majah", ar: "سنن ابن ماجه" }],
  ["malik", { en: "Muwatta Malik", ar: "موطأ مالك" }],
  ["nawawi", { en: "40 Hadith Nawawi", ar: "الأربعون النووية" }],
  ["qudsi", { en: "40 Hadith Qudsi", ar: "الأربعون القدسية" }],
  ["dehlawi", { en: "40 Hadith Shah Waliullah", ar: "الأربعون للدهلوي" }],
  ["riyadussalihin", { en: "Riyad as-Salihin", ar: "رياض الصالحين" }],
  ["adab", { en: "Al-Adab Al-Mufrad", ar: "الأدب المفرد" }],
  ["darimi", { en: "Sunan ad-Darimi", ar: "سنن الدارمي" }],
  ["ahmad", { en: "Musnad Ahmad", ar: "مسند أحمد بن حنبل" }],
]);
const COLLECTION_ORDER = [...COLLECTION_NAMES.keys()];

const CACHE_LIMIT = 2_000;

const cached = <Args extends (string | number)[], Result>(
  load: (...args: Args) => Promise<Result>,
) => {
  const results = new Map<string, Promise<Result>>();
  return (...args: Args) => {
    const key = args.join(":");
    const hit = results.get(key);
    if (hit) return hit;
    const pending = load(...args);
    results.set(key, pending);
    pending.catch(() => results.delete(key));
    const oldest = results.keys().next();
    if (results.size > CACHE_LIMIT && !oldest.done)
      results.delete(oldest.value);
    return pending;
  };
};

export const quranIndex = cached(async () => {
  const [list, juzs, pages, languages, translationList, tafsirList] =
    await Promise.all([
      db.select().from(surahs).orderBy(asc(surahs.number)),
      db
        .selectDistinctOn([verses.juz], {
          juz: verses.juz,
          surah: verses.surah,
          ayah: verses.ayah,
          firstPage: verses.page,
          lastPage: sql<number>`max(${verses.page}) over (partition by ${verses.juz})`,
        })
        .from(verses)
        .orderBy(asc(verses.juz), asc(verses.surah), asc(verses.ayah)),
      db
        .selectDistinctOn([verses.page], {
          page: verses.page,
          surah: verses.surah,
          ayah: verses.ayah,
        })
        .from(verses)
        .orderBy(asc(verses.page), asc(verses.surah), asc(verses.ayah)),
      db
        .selectDistinct({ lang: texts.lang })
        .from(texts)
        .where(like(texts.source, ABRIDGED))
        .orderBy(asc(texts.lang)),
      db
        .select({
          id: translations.id,
          name: translations.name,
          lang: translations.lang,
          kind: translations.kind,
          verses: count(verseTranslations.ayah),
        })
        .from(translations)
        .leftJoin(
          verseTranslations,
          eq(verseTranslations.translation, translations.id),
        )
        .groupBy(translations.id)
        .orderBy(asc(translations.lang), asc(translations.name)),
      db.select().from(tafsirs).orderBy(asc(tafsirs.lang), asc(tafsirs.id)),
    ]);
  return {
    surahs: list,
    juzs,
    pages,
    tafsirLanguages: languages.map((row) => row.lang),
    translations: translationList,
    tafsirs: tafsirList,
  };
});

export const quranSurah = cached(async (number: number) => {
  const [surah] = await db
    .select()
    .from(surahs)
    .where(eq(surahs.number, number));
  if (!surah) throw new StatusError(404, `There is no surah ${number}`);
  const ayahs = await db
    .select({
      ayah: verses.ayah,
      juz: verses.juz,
      page: verses.page,
      textAr: verses.textAr,
      textEn: verses.textEn,
      footnotesEn: verses.footnotesEn,
      words: verseWords.words,
    })
    .from(verses)
    .leftJoin(
      verseWords,
      and(eq(verseWords.surah, verses.surah), eq(verseWords.ayah, verses.ayah)),
    )
    .where(eq(verses.surah, number))
    .orderBy(asc(verses.ayah));
  return { surah, ayahs };
});

export const quranWords = cached(async (surah: number, lang: string) => {
  const language = WORD_LANGUAGES.find((code) => code === lang) ?? "en";
  const [rows, meanings] = await Promise.all([
    db
      .select({
        ayah: verseWords.ayah,
        transliteration: verseWords.transliteration,
      })
      .from(verseWords)
      .where(eq(verseWords.surah, surah)),
    db
      .select({
        ayah: wordMeanings.ayah,
        lang: wordMeanings.lang,
        meanings: wordMeanings.meanings,
      })
      .from(wordMeanings)
      .where(
        and(
          eq(wordMeanings.surah, surah),
          inArray(wordMeanings.lang, [language, "en"]),
        ),
      ),
  ]);
  const meaningsOf = (ayah: number, code: string) =>
    meanings.find((row) => row.ayah === ayah && row.lang === code)?.meanings ??
    [];
  return {
    lang: language,
    ayahs: rows
      .toSorted((a, b) => a.ayah - b.ayah)
      .map((row) => {
        const english = meaningsOf(row.ayah, "en");
        const chosen = meaningsOf(row.ayah, language);
        return {
          ayah: row.ayah,
          transliteration: row.transliteration ?? [],
          meanings: english.map((meaning, index) => chosen[index] || meaning),
        };
      }),
  };
});

export const quranTafsirText = cached(
  async (tafsir: number, surah: number, ayah: number) => {
    const [passage] = await db
      .select({
        fromAyah: tafsirTexts.fromAyah,
        toAyah: tafsirTexts.toAyah,
        body: tafsirTexts.body,
      })
      .from(tafsirTexts)
      .where(
        and(
          eq(tafsirTexts.tafsir, tafsir),
          eq(tafsirTexts.surah, surah),
          lte(tafsirTexts.fromAyah, ayah),
          gte(tafsirTexts.toAyah, ayah),
        ),
      )
      .limit(1);
    return passage ?? null;
  },
);

export const quranTranslation = cached(
  async (translation: number, surah: number) =>
    db
      .select({
        ayah: verseTranslations.ayah,
        text: verseTranslations.text,
        footnotes: verseTranslations.footnotes,
      })
      .from(verseTranslations)
      .where(
        and(
          eq(verseTranslations.translation, translation),
          eq(verseTranslations.surah, surah),
        ),
      )
      .orderBy(asc(verseTranslations.ayah)),
);

export const quranTimings = cached(async (recitation: number, surah: number) =>
  db
    .select({
      ayah: recitationTimings.ayah,
      segments: recitationTimings.segments,
    })
    .from(recitationTimings)
    .where(
      and(
        eq(recitationTimings.recitation, recitation),
        eq(recitationTimings.surah, surah),
      ),
    )
    .orderBy(asc(recitationTimings.ayah)),
);

export const quranTafsir = cached(
  async (
    surah: number,
    ayah: number,
    lang: (typeof TEXT_LANGUAGES)[number],
  ) => {
    const [notes, english] = await Promise.all([
      db
        .select({
          source: texts.source,
          body: texts.body,
          credit: sources.credit,
        })
        .from(texts)
        .innerJoin(sources, eq(sources.name, texts.source))
        .where(
          and(
            eq(texts.ref, `quran:${surah}:${ayah}`),
            eq(texts.kind, "tafsir"),
            or(
              eq(texts.source, MUYASSAR),
              and(like(texts.source, ABRIDGED), eq(texts.lang, lang)),
            ),
          ),
        ),
      db
        .select({
          fromAyah: tafsirPassages.fromAyah,
          toAyah: tafsirPassages.toAyah,
          body: tafsirPassages.body,
        })
        .from(tafsirPassages)
        .where(
          and(
            eq(tafsirPassages.surah, surah),
            eq(tafsirPassages.lang, "en"),
            lte(tafsirPassages.fromAyah, ayah),
            gte(tafsirPassages.toAyah, ayah),
          ),
        ),
    ]);
    const muyassar = notes.find((row) => row.source === MUYASSAR);
    const abridged = notes.find((row) => row.source !== MUYASSAR);
    return {
      arabic: muyassar?.body ?? null,
      abridged: abridged
        ? { body: abridged.body, credit: abridged.credit }
        : null,
      english: english[0] ?? null,
    };
  },
);

const collectionRank = (id: string) =>
  COLLECTION_ORDER.includes(id)
    ? COLLECTION_ORDER.indexOf(id)
    : COLLECTION_ORDER.length;

const collectionOf = (id: string, total: number) => ({
  id,
  nameEn: COLLECTION_NAMES.get(id)?.en ?? id,
  nameAr: COLLECTION_NAMES.get(id)?.ar ?? "",
  hadiths: total,
});

export const hadithCollections = cached(async () => {
  const rows = await db
    .select({
      id: hadiths.book,
      total: count(),
    })
    .from(hadiths)
    .groupBy(hadiths.book);
  return rows
    .filter((row) => COLLECTION_NAMES.has(row.id))
    .toSorted((a, b) => collectionRank(a.id) - collectionRank(b.id))
    .map((row) => collectionOf(row.id, row.total));
});

const booksOf = (collection: string) =>
  db
    .select({
      number: hadiths.chapter,
      name: min(hadiths.chapterEn),
      hadiths: count(),
      first: min(hadiths.number),
      last: max(hadiths.number),
    })
    .from(hadiths)
    .where(eq(hadiths.book, collection))
    .groupBy(hadiths.chapter)
    .orderBy(asc(hadiths.chapter));

const collectionById = async (id: string) => {
  const collection = (await hadithCollections()).find((c) => c.id === id);
  if (!collection) throw new StatusError(404, `There is no collection ${id}`);
  return collection;
};

export const hadithBooks = cached(async (collection: string) => {
  const [found, books] = await Promise.all([
    collectionById(collection),
    booksOf(collection),
  ]);
  return { collection: found, books };
});

export const hadithPage = cached(
  async (collection: string, book: number, page: number) => {
    const [found, books, rows] = await Promise.all([
      collectionById(collection),
      booksOf(collection),
      db
        .select({
          id: hadiths.id,
          number: hadiths.number,
          textAr: hadiths.textAr,
        })
        .from(hadiths)
        .where(and(eq(hadiths.book, collection), eq(hadiths.chapter, book)))
        .orderBy(asc(hadiths.number), asc(hadiths.id))
        .limit(HADITHS_PER_PAGE + 1)
        .offset(page * HADITHS_PER_PAGE),
    ]);
    const current = books.find((entry) => entry.number === book);
    if (!current) throw new StatusError(404, `There is no book ${book}`);
    const shown = rows.slice(0, HADITHS_PER_PAGE);
    const english = new Map(
      (await hadithsByIds(shown.map((row) => row.id))).map((hadith) => [
        hadith.id,
        hadith.english,
      ]),
    );
    return {
      collection: found,
      book: current,
      books: books.length,
      hadiths: shown.map((row) => ({
        id: row.id,
        number: row.number,
        textAr: row.textAr,
        english: english.get(row.id) ?? null,
      })),
      more: rows.length > HADITHS_PER_PAGE,
    };
  },
);
