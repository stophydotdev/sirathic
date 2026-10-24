import { readFile } from "node:fs/promises";
import { arabicWords } from "@sirathic/core/search/arabic";
import { db } from "@sirathic/db";
import {
  duas,
  hadithGrades,
  hadiths,
  sources,
  surahs,
  tafsirPassages,
  texts,
  verses,
} from "@sirathic/db/schema";
import { ne, notInArray } from "drizzle-orm";
import { z } from "zod";
import {
  DATA_DIR,
  FIQH_SOURCE,
  HADITH_ENGLISH_SOURCE,
  HADITH_COMMIT,
  HADITHS_PER_BOOK,
  MOKHTASAR_LANGUAGES,
  mokhtasarCredit,
  WIKISOURCE_BOOKS,
  WIKISOURCE_SOURCE,
} from "./catalog";
import { EMBEDDED, fillSearchEnglish, keepEmbeddings } from "./embeddings";
import { TAZKIRUL_PDF } from "./tazkirul";

const CHUNK_SIZE = 1000;
const ARABIC_MARKS = /[ـً-ٰٟۖ-ۭ]/gu;
const REVELATION = { Meccan: "meccan", Medinan: "medinan" } as const;
const MATCH_THRESHOLD = 0.7;
const DUA_CATEGORY_ROOTS = new Set(["268", "465", "211"]);
const ROWWAD_TERMS =
  "Republishing allowed, commercial use not excluded: no changes, credit the publisher and the site, mention the version, keep up to date, no inappropriate ads";
const ATTRIBUTED_BOOKS = [
  ["متفق", ["bukhari", "muslim"]],
  ["البخاري", ["bukhari"]],
  ["مسلم", ["muslim"]],
  ["أبو داود", ["abudawud"]],
  ["الترمذي", ["tirmidhi"]],
  ["النسائي", ["nasai"]],
  ["ابن ماجه", ["ibnmajah"]],
  ["مالك", ["malik"]],
] as const;

const surahTag = z.object({
  index: z.coerce.number(),
  ayas: z.coerce.number(),
  start: z.coerce.number(),
  name: z.string(),
  tname: z.string(),
  ename: z.string(),
  type: z.enum(["Meccan", "Medinan"]),
});

const startTag = z.object({
  sura: z.coerce.number(),
  aya: z.coerce.number(),
});

const edition = z.object({
  metadata: z.object({ sections: z.record(z.string(), z.string()) }),
  hadiths: z.array(
    z.object({
      hadithnumber: z.number(),
      arabicnumber: z.union([z.number(), z.string()]).optional(),
      text: z.string(),
      grades: z.array(z.object({ name: z.string(), grade: z.string() })),
      reference: z.object({ book: z.number() }),
    }),
  ),
});

const quranEncFile = z.object({
  version: z.string().nullable(),
  verses: z.array(
    z.object({
      sura: z.string(),
      aya: z.string(),
      translation: z.string(),
      footnotes: z.string().nullable(),
    }),
  ),
});

const hadeethEncFile = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    hadeeth: z.string(),
    hadeeth_ar: z.string(),
    attribution: z.string(),
    attribution_ar: z.string(),
    grade: z.string(),
    explanation: z.string(),
    categories: z.array(z.string()),
  }),
);

const tazkirulFile = z.array(
  z.object({
    surah: z.number(),
    from: z.number(),
    to: z.number(),
    commentary: z.string(),
  }),
);

const wikisourceFile = z.object({
  fetchedAt: z.string(),
  hadiths: z.array(
    z.object({
      number: z.number(),
      chapter: z.number(),
      url: z.string(),
      text: z.string(),
      grade: z.string().nullable(),
    }),
  ),
});

const hadeethEncCategories = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    parent_id: z.string().nullable(),
  }),
);

const read = (path: string) => readFile(`${DATA_DIR}/${path}`, "utf8");

const readQuranEnc = async (key: string) => {
  const file = quranEncFile.parse(JSON.parse(await read(`quranenc/${key}.json`)));
  return {
    version: file.version ?? "unversioned",
    verses: new Map(file.verses.map((verse) => [`${verse.sura}:${verse.aya}`, verse])),
  };
};

const readEdition = async (path: string) => edition.parse(JSON.parse(await read(path)));

const verseTexts = async (path: string) =>
  new Map(
    (await read(path)).split("\n").flatMap((line) => {
      const match = /^(\d+)\|(\d+)\|(.+)$/u.exec(line);
      return match ? [[`${match[1]}:${match[2]}`, match[3]] as const] : [];
    }),
  );

const required = <Value>(values: Map<string, Value>, key: string) => {
  const value = values.get(key);
  if (value === undefined) throw new Error(`Verse ${key} is missing`);
  return value;
};

const tagsOf = (xml: string, tag: string) =>
  [...xml.matchAll(new RegExp(`<${tag} ([^>]*)/>`, "gu"))].map(([, attributes = ""]) =>
    Object.fromEntries(
      [...attributes.matchAll(/(\w+)="([^"]*)"/gu)].map(([, name, value]) => [name, value]),
    ),
  );

const sectionOf = (starts: number[], position: number) =>
  starts.filter((start) => start <= position).length;

const textOrNull = (text: string) => text.trim() || null;

const citationOf = (book: string, hadith: z.infer<typeof edition>["hadiths"][number]) => {
  if (book !== "muslim") {
    return {
      id: `${book}:${hadith.hadithnumber}`,
      number: hadith.hadithnumber,
    };
  }
  if (hadith.arabicnumber === undefined) return null;
  const [whole, variant] = String(hadith.arabicnumber).split(".");
  const letter = variant === undefined ? "" : String.fromCodePoint(96 + Number(variant));
  return {
    id: `muslim:${whole}${letter}`,
    number: Number(hadith.arabicnumber),
  };
};

const quotedOrAll = (text: string) => {
  const quoted = [...text.matchAll(/«([^»]*)»/gu)].map(([, words = ""]) => words);
  return quoted.length > 0 ? quoted.join(" ") : text;
};

const chunks = <Row>(rows: Row[]) =>
  Array.from({ length: Math.ceil(rows.length / CHUNK_SIZE) }, (_, index) =>
    rows.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
  );

const xml = await read("quran/quran-data.xml");
const surahList = tagsOf(xml, "sura").map((tag) => surahTag.parse(tag));
const startsOf = (tag: string) =>
  tagsOf(xml, tag).map((attributes) => {
    const { sura, aya } = startTag.parse(attributes);
    return surahList[sura - 1].start + aya - 1;
  });
const juzStarts = startsOf("juz");
const pageStarts = startsOf("page");

const [uthmani, clean] = await Promise.all(
  ["quran/uthmani.txt", "quran/simple-clean.txt"].map(verseTexts),
);
const [saheeh, moyassar] = await Promise.all(
  ["english_saheeh", "arabic_moyassar"].map(readQuranEnc),
);
const mokhtasars = await Promise.all(
  MOKHTASAR_LANGUAGES.map(async ([language, lang]) => ({
    language,
    lang,
    source: `quranenc-${language}_mokhtasar`,
    file: await readQuranEnc(`${language}_mokhtasar`),
  })),
);

const surahRows = surahList.map((surah) => ({
  number: surah.index,
  nameAr: surah.name,
  nameEn: surah.ename,
  nameTranslit: surah.tname,
  revelation: REVELATION[surah.type],
  verseCount: surah.ayas,
}));

const withoutBasmala = (surah: number, ayah: number, text: string) =>
  ayah === 1 && surah !== 1 && surah !== 9 ? text.split(" ").slice(4).join(" ") : text;

const verseRows = surahList.flatMap((surah) =>
  Array.from({ length: surah.ayas }, (_, index) => {
    const ayah = index + 1;
    const key = `${surah.index}:${ayah}`;
    const position = surah.start + index;
    const english = required(saheeh.verses, key);
    return {
      id: `quran:${key}`,
      surah: surah.index,
      ayah,
      juz: sectionOf(juzStarts, position),
      page: sectionOf(pageStarts, position),
      textAr: withoutBasmala(surah.index, ayah, required(uthmani, key)),
      textArClean: withoutBasmala(surah.index, ayah, required(clean, key)),
      textEn: english.translation,
      footnotesEn: textOrNull(english.footnotes ?? ""),
    };
  }),
);

const tafsirRows = verseRows.map((verse) => ({
  ref: verse.id,
  source: "quranenc-arabic_moyassar",
  kind: "tafsir" as const,
  lang: "ar" as const,
  body: required(moyassar.verses, `${verse.surah}:${verse.ayah}`).translation,
}));

const abridgedRows = mokhtasars.flatMap(({ lang, source, file }) =>
  verseRows
    .map((verse) => ({
      ref: verse.id,
      source,
      kind: "tafsir" as const,
      lang,
      body: required(file.verses, `${verse.surah}:${verse.ayah}`).translation,
    }))
    .filter((row) => row.body.trim() !== ""),
);

const commentaries = tazkirulFile
  .parse(JSON.parse(await read("cps/tazkirul_quran.json")))
  .toSorted((a, b) => a.surah - b.surah || a.from - b.from);
const commentaryRows = commentaries.map(({ surah, from, to, commentary }, index) => {
  const next = commentaries[index + 1];
  const end = next?.surah === surah ? next.from - 1 : surahList[surah - 1].ayas;
  return {
    source: "cps-tazkirul_quran",
    surah,
    fromAyah: from,
    toAyah: Math.max(to, end),
    lang: "en" as const,
    body: commentary,
  };
});

const bookEntries = await Promise.all(
  Object.keys(HADITHS_PER_BOOK).map(async (book) => {
    const [englishEdition, arabicEdition] = await Promise.all([
      readEdition(`hadith/eng-${book}.json`),
      readEdition(`hadith/ara-${book}.json`),
    ]);
    const arabicText = new Map(
      arabicEdition.hadiths.map((hadith) => [hadith.hadithnumber, hadith.text]),
    );
    return englishEdition.hadiths.flatMap((hadith) => {
      const textEn = textOrNull(hadith.text);
      const textAr = textOrNull(arabicText.get(hadith.hadithnumber) ?? "");
      const citation = citationOf(book, hadith);
      if (citation === null || (textEn === null && textAr === null)) return [];
      const { id, number } = citation;
      const chapter = hadith.reference.book;
      return [
        {
          row: {
            id,
            book,
            number,
            arabicNumber: hadith.arabicnumber === undefined ? null : String(hadith.arabicnumber),
            chapter,
            chapterEn: textOrNull(englishEdition.metadata.sections[chapter] ?? ""),
            textAr,
            textArClean: textAr?.replace(ARABIC_MARKS, "") ?? null,
            textEn,
            source: "hadith-api",
            url: null,
          },
          grades: hadith.grades.map((grade) => ({
            hadithId: id,
            grader: grade.name,
            grade: grade.grade,
          })),
        },
      ];
    });
  }),
);

const wikisourceEntries = await Promise.all(
  Object.keys(WIKISOURCE_BOOKS).map(async (book) => {
    const file = wikisourceFile.parse(JSON.parse(await read(`wikisource/${book}.json`)));
    return {
      fetchedAt: file.fetchedAt,
      entries: file.hadiths.map((hadith) => {
        const id = `${book}:${hadith.number}`;
        return {
          row: {
            id,
            book,
            number: hadith.number,
            arabicNumber: null,
            chapter: hadith.chapter,
            chapterEn: null,
            textAr: hadith.text,
            textArClean: hadith.text.replace(ARABIC_MARKS, ""),
            textEn: null,
            source: WIKISOURCE_SOURCE,
            url: hadith.url,
          },
          grades:
            hadith.grade === null
              ? []
              : [
                  {
                    hadithId: id,
                    grader: "Unattributed note on Arabic Wikisource",
                    grade: hadith.grade,
                  },
                ],
        };
      }),
    };
  }),
);

const allEntries = [...bookEntries.flat(), ...wikisourceEntries.flatMap(({ entries }) => entries)];
const hadithRows = allEntries.map((entry) => entry.row);
const gradeRows = allEntries.flatMap((entry) => entry.grades);

const hadithWords = bookEntries
  .flat()
  .flatMap(({ row }) =>
    row.textAr === null ? [] : [{ id: row.id, book: row.book, words: arabicWords(row.textAr) }],
  );
const frequency = new Map<string, number>();
const postings = new Map<string, string[]>();
for (const { id, book, words } of hadithWords) {
  for (const word of words) {
    frequency.set(word, (frequency.get(word) ?? 0) + 1);
    const key = `${book} ${word}`;
    const ids = postings.get(key);
    if (ids === undefined) postings.set(key, [id]);
    else ids.push(id);
  }
}
const weight = (word: string) => Math.log(hadithWords.length / (1 + (frequency.get(word) ?? 0)));

const hadeethEnc = hadeethEncFile.parse(JSON.parse(await read("hadeethenc/en.json")));
const matches = hadeethEnc.flatMap((hadeeth) => {
  const words = [...arabicWords(quotedOrAll(hadeeth.hadeeth_ar))];
  const total = words.reduce((sum, word) => sum + weight(word), 0);
  const books = new Set(
    ATTRIBUTED_BOOKS.filter(([name]) => hadeeth.attribution_ar.includes(name)).flatMap(
      ([, names]) => names,
    ),
  );
  return [...books].flatMap((book) => {
    const scores = new Map<string, number>();
    for (const word of words) {
      for (const id of postings.get(`${book} ${word}`) ?? []) {
        scores.set(id, (scores.get(id) ?? 0) + weight(word));
      }
    }
    const [ref, score] = [...scores].reduce(
      (best, entry) => (entry[1] > best[1] ? entry : best),
      ["", 0],
    );
    return score >= MATCH_THRESHOLD * total ? [{ ref, score: score / total, hadeeth }] : [];
  });
});
const bestMatches = [
  ...matches
    .reduce(
      (byRef, match) =>
        match.score > (byRef.get(match.ref)?.score ?? 0) ? byRef.set(match.ref, match) : byRef,
      new Map<string, (typeof matches)[number]>(),
    )
    .values(),
];
const hadeethEncRows = bestMatches.flatMap(({ ref, hadeeth }) => [
  {
    ref,
    source: "hadeethenc-en",
    kind: "translation" as const,
    lang: "en" as const,
    body: hadeeth.hadeeth,
  },
  {
    ref,
    source: "hadeethenc-en",
    kind: "explanation" as const,
    lang: "en" as const,
    body: hadeeth.explanation,
  },
]);
const textRows = [...tafsirRows, ...abridgedRows, ...hadeethEncRows];

const categories = hadeethEncCategories.parse(JSON.parse(await read("hadeethenc/categories.json")));
const parentOf = new Map(categories.map((category) => [category.id, category.parent_id]));
const titleOf = new Map(categories.map((category) => [category.id, category.title]));
const isDuaCategory = (id: string | null | undefined): boolean =>
  id !== null &&
  id !== undefined &&
  (DUA_CATEGORY_ROOTS.has(id) || isDuaCategory(parentOf.get(id)));
const hadithOf = new Map(
  matches.toSorted((a, b) => a.score - b.score).map((match) => [match.hadeeth, match.ref]),
);
const duaRows = hadeethEnc.flatMap((hadeeth) => {
  const occasions = hadeeth.categories.filter(isDuaCategory);
  return occasions.length === 0
    ? []
    : [
        {
          id: `hadeethenc:${hadeeth.id}`,
          title: hadeeth.title,
          occasions: occasions.map((id) => titleOf.get(id) ?? id),
          textAr: hadeeth.hadeeth_ar,
          textArClean: hadeeth.hadeeth_ar.replace(ARABIC_MARKS, ""),
          textEn: hadeeth.hadeeth,
          explanation: hadeeth.explanation,
          attribution: hadeeth.attribution,
          grade: hadeeth.grade,
          hadithId: hadithOf.get(hadeeth) ?? null,
        },
      ];
});

const sourceRows = [
  {
    name: "tanzil-quran-text",
    url: "https://tanzil.net/download/",
    version: "Uthmani 1.1, Simple Clean 1.1",
    license: "CC BY 3.0. Verbatim copies only; credit and link tanzil.net",
    credit: "Quran text: Tanzil Project, tanzil.net",
  },
  {
    name: "tanzil-quran-metadata",
    url: "https://tanzil.net/docs/quran_metadata",
    version: "1.0",
    license: "CC BY",
    credit: "Quran metadata: Tanzil Project, tanzil.net",
  },
  {
    name: "quranenc-english_saheeh",
    url: "https://quranenc.com/en/browse/english_saheeh",
    version: saheeh.version,
    license: ROWWAD_TERMS,
    credit: `English Translation - Noor International Center, QuranEnc.com, v${saheeh.version}`,
  },
  {
    name: "quranenc-arabic_moyassar",
    url: "https://quranenc.com/ar/browse/arabic_moyassar",
    version: moyassar.version,
    license: ROWWAD_TERMS,
    credit: "اللغة العربية - التفسير الميسر، QuranEnc.com",
  },
  ...mokhtasars.map(({ language, source, file }) => ({
    name: source,
    url: `https://quranenc.com/api/v1/translation/sura/${language}_mokhtasar/1`,
    version: file.version,
    license: ROWWAD_TERMS,
    credit: mokhtasarCredit(language),
  })),
  {
    name: "cps-tazkirul_quran",
    url: TAZKIRUL_PDF,
    version: "Goodword Books 2011, reprinted 2024",
    license: "Copyright free, per the publisher's imprint",
    credit:
      "Quran commentary by Maulana Wahiduddin Khan, translated by Farida Khanam, CPS International, cpsglobal.org",
  },
  {
    name: "hadeethenc-en",
    url: "https://hadeethenc.com/en/home",
    version: "unversioned",
    license: ROWWAD_TERMS,
    credit: "Encyclopedia of Translated Prophetic Hadiths, HadeethEnc.com",
  },
  {
    name: WIKISOURCE_SOURCE,
    url: "https://ar.wikisource.org/wiki/%D9%88%D9%8A%D9%83%D9%8A_%D9%85%D8%B5%D8%AF%D8%B1:%D9%83%D8%AA%D8%A8_%D8%A7%D9%84%D8%B3%D9%86%D8%A9",
    version: `Fetched ${wikisourceEntries.map(({ fetchedAt }) => fetchedAt).toSorted()[0] ?? "unknown"}`,
    license: "CC BY-SA 4.0",
    credit: "Arabic text from Arabic Wikisource contributors, CC BY-SA 4.0",
  },
  {
    name: "hadith-api",
    url: `https://github.com/fawazahmed0/hadith-api/tree/${HADITH_COMMIT}`,
    version: HADITH_COMMIT,
    license:
      "Unlicense; English translations come from published books, so they are kept for search only and never shown",
    credit: null,
  },
];

await db.transaction(async (tx) => {
  const restoreVerses = await keepEmbeddings(tx, EMBEDDED.verses);
  const restoreHadiths = await keepEmbeddings(tx, EMBEDDED.hadiths);
  const restoreDuas = await keepEmbeddings(tx, EMBEDDED.duas);
  await tx.delete(texts).where(ne(texts.source, HADITH_ENGLISH_SOURCE));
  await tx.delete(tafsirPassages);
  await tx.delete(duas);
  await tx.delete(hadithGrades);
  await tx.delete(hadiths);
  await tx.delete(verses);
  await tx.delete(surahs);
  await tx.delete(sources).where(notInArray(sources.name, [FIQH_SOURCE, HADITH_ENGLISH_SOURCE]));
  await tx.insert(sources).values(sourceRows);
  await tx.insert(surahs).values(surahRows);
  await Promise.all(chunks(verseRows).map((rows) => tx.insert(verses).values(rows)));
  await Promise.all(chunks(hadithRows).map((rows) => tx.insert(hadiths).values(rows)));
  await Promise.all(chunks(gradeRows).map((rows) => tx.insert(hadithGrades).values(rows)));
  await Promise.all(chunks(textRows).map((rows) => tx.insert(texts).values(rows)));
  await Promise.all(chunks(commentaryRows).map((rows) => tx.insert(tafsirPassages).values(rows)));
  await tx.insert(duas).values(duaRows);
  await fillSearchEnglish(tx);
  await restoreVerses();
  await restoreHadiths();
  await restoreDuas();
});

console.log(
  `Loaded ${surahRows.length} surahs, ${verseRows.length} verses, ${hadithRows.length} hadiths, ${gradeRows.length} grades, ${tafsirRows.length} tafsir notes, ${commentaryRows.length} Tazkirul Quran passages, ${bestMatches.length} HadeethEnc translations (${new Set(bestMatches.map(({ hadeeth }) => hadeeth)).size} of ${hadeethEnc.length} HadeethEnc hadith matched), ${duaRows.length} duas (${duaRows.filter((dua) => dua.hadithId !== null).length} linked to our hadith)`,
);
await db.$client.end();
