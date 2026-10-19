import { readdir } from "node:fs/promises";
import { db } from "@sirathic/db";
import {
  recitationTimings,
  tafsirs,
  tafsirTexts,
  translations,
  verseTranslations,
  verseWords,
  wordMeanings,
} from "@sirathic/db/schema";
import { $ } from "bun";
import { z } from "zod";
import {
  DUPLICATE_TRANSLATIONS,
  QUL_DIR,
  QUL_TAFSIRS,
  QUL_TRANSLITERATION,
  QUL_VERSE_TRANSLITERATION,
  QUL_WORDS,
  TIMED_RECITATIONS,
  TRANSLATION_LANGUAGES,
  WORD_MEANINGS,
} from "./catalog";

const CHUNK_SIZE = 1000;
const QURAN_VERSES = 6236;
const VERSE_NUMBER = /^[٠-٩]+$/u;

const wordFile = z.record(
  z.string(),
  z.object({
    surah: z.coerce.number(),
    ayah: z.coerce.number(),
    word: z.coerce.number(),
    text: z.string(),
  }),
);

const glossFile = z.record(z.string(), z.string());

const recitationFile = z.record(
  z.string(),
  z.object({
    surah_number: z.coerce.number(),
    ayah_number: z.coerce.number(),
    audio_url: z.string(),
    segments: z.array(z.array(z.union([z.number(), z.string()]))),
  }),
);

const manifestFile = z.object({
  resources: z.array(
    z.object({
      category: z.string(),
      id: z.coerce.number(),
      name: z.string(),
      tags: z.string(),
      files: z.array(z.unknown()),
    }),
  ),
});

const textPart = z
  .string()
  .transform((value) => ({ kind: "text" as const, value }));
const notePart = z.union([
  z
    .object({ f: z.union([z.number(), z.string()]) })
    .transform(({ f }) => ({ kind: "note" as const, key: String(f) })),
  z
    .object({ type: z.literal("f"), text: z.string() })
    .transform(({ text }) => ({ kind: "note" as const, key: text })),
]);
const inlinePart = z
  .object({ type: z.string(), text: z.string() })
  .transform(({ text }) => ({ kind: "text" as const, value: text }));
const translationFile = z.record(
  z.string(),
  z.union([
    textPart.transform((part) => ({
      parts: [part],
      notes: new Map<string, string>(),
    })),
    z
      .object({
        t: z.union([
          textPart.transform((part) => [part]),
          z.array(z.union([textPart, notePart, inlinePart])),
        ]),
        f: z.record(z.string(), z.string()).default({}),
      })
      .transform(({ t, f }) => ({
        parts: t,
        notes: new Map(Object.entries(f)),
      })),
  ]),
);

const flatten = ({
  parts,
  notes,
}: z.output<typeof translationFile>[string]) => {
  const footnotes: string[] = [];
  const text = parts
    .map((part) => {
      if (part.kind === "text") return part.value;
      footnotes.push(notes.get(part.key)?.trim() ?? "");
      return `[${footnotes.length}]`;
    })
    .join("")
    .trim();
  return { text, footnotes: footnotes.length > 0 ? footnotes : null };
};

const decodeEntities = (text: string) =>
  text
    .replaceAll("&amp;", "&")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"');

const unzipJson = async (path: string) =>
  JSON.parse(await $`unzip -p ${path}`.quiet().text());

const chunks = <Row>(rows: Row[], size: number = CHUNK_SIZE) =>
  Array.from({ length: Math.ceil(rows.length / size) }, (_, index) =>
    rows.slice(index * size, (index + 1) * size),
  );

const TAFSIR_CHUNK_SIZE = 100;
const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "blockquote",
]);
const DROPPED_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "template",
]);

const tafsirFile = z.record(
  z.string(),
  z.union([
    z.string().transform((owner) => ({ owner })),
    z.object({ text: z.string() }),
  ]),
);

const cleanHtml = async (html: string) => {
  const rewriter = new HTMLRewriter().on("*", {
    element(element) {
      if (DROPPED_TAGS.has(element.tagName)) element.remove();
      else if (!ALLOWED_TAGS.has(element.tagName))
        element.removeAndKeepContent();
      else
        for (const name of Array.from(element.attributes, ([key]) => key))
          element.removeAttribute(name);
    },
    comments(comment) {
      comment.remove();
    },
  });
  const cleaned = await rewriter.transform(new Response(html)).text();
  return cleaned
    .replace(/\[\[[^\]]*\]\]/gu, "")
    .replace(/<p>\s*<\/p>/gu, "")
    .trim();
};

const words = Object.values(
  wordFile.parse(await unzipJson(`${QUL_DIR}/${QUL_WORDS}`)),
).filter((word) => !VERSE_NUMBER.test(word.text));
const wordsByVerse = new Map<string, typeof words>();
for (const word of words) {
  const key = `${word.surah}:${word.ayah}`;
  const list = wordsByVerse.get(key);
  if (list) list.push(word);
  else wordsByVerse.set(key, [word]);
}
const resourcePath = async (category: string, id: number) => {
  const folder = (await readdir(`${QUL_DIR}/${category}`)).find((name) =>
    name.startsWith(`${id}-`),
  );
  const file = folder && (await readdir(`${QUL_DIR}/${category}/${folder}`))[0];
  if (!file) throw new Error(`${category} ${id} is not in ${QUL_DIR}`);
  return `${QUL_DIR}/${category}/${folder}/${file}`;
};

const glossesAt = async (category: string, id: number) =>
  new Map(
    Object.entries(
      glossFile.parse(await unzipJson(await resourcePath(category, id))),
    ),
  );

const verseList = [...wordsByVerse].map(([key, list]) => ({
  key,
  list: list.toSorted((a, b) => a.word - b.word),
}));
const glossesFor = (
  glosses: Map<string, string>,
  { key, list }: (typeof verseList)[number],
) => list.map((word) => glosses.get(`${key}:${word.word}`)?.trim() ?? "");

const transliteration = await glossesAt("transliteration", QUL_TRANSLITERATION);
const wordRows = verseList.map((verse) => ({
  surah: verse.list[0]?.surah ?? 0,
  ayah: verse.list[0]?.ayah ?? 0,
  words: verse.list.map((word) => word.text),
  transliteration: glossesFor(transliteration, verse),
}));

const meaningRows = (
  await Promise.all(
    WORD_MEANINGS.map(async ([lang, id]) => {
      const glosses = await glossesAt("translation", id);
      const rows = verseList
        .map((verse) => ({
          surah: verse.list[0]?.surah ?? 0,
          ayah: verse.list[0]?.ayah ?? 0,
          lang,
          meanings: glossesFor(glosses, verse),
        }))
        .filter((row) => row.meanings.some(Boolean));
      const filled = rows.flatMap((row) => row.meanings.filter(Boolean)).length;
      console.log(`meanings ${lang}: ${filled} of ${words.length} words`);
      return rows;
    }),
  )
).flat();
if (wordRows.length !== QURAN_VERSES)
  throw new Error(
    `Expected ${QURAN_VERSES} verses of words, got ${wordRows.length}`,
  );

const textsByVerse = new Map(
  wordRows.map((row) => [`${row.surah}:${row.ayah}`, row.words]),
);

const ARABIC_LETTER = /[ء-يٱ]/u;
const JOINED_PARTICLE = /^(?:وَ)?(?:يَـ?ٰ|هَـ?ٰٓأ)/u;

const piecesOf = (text: string) => {
  const bare = text.replace(/^۞\s*/u, "");
  const parts = bare.split(" ").filter((part) => ARABIC_LETTER.test(part));
  return parts.length + (JOINED_PARTICLE.test(bare) ? 1 : 0);
};

const wordMap = (texts: string[], highest: number) => {
  if (highest <= texts.length) return texts.map((_, index) => index + 1);
  const expanded = texts.flatMap((text, index) =>
    Array.from({ length: piecesOf(text) }, () => index + 1),
  );
  return expanded.length === highest ? expanded : undefined;
};

const timingRows = await Promise.all(
  TIMED_RECITATIONS.map(async (recitation) => {
    const verses = Object.values(
      recitationFile.parse(
        await unzipJson(await resourcePath("recitation", recitation)),
      ),
    );
    const bases = new Set(
      verses.map((verse) => verse.audio_url.replace(/\/\d{6}\.mp3$/u, "")),
    );
    if (bases.size !== 1)
      throw new Error(`Recitation ${recitation} has ${bases.size} audio bases`);
    const rows = verses.flatMap((verse) => {
      const segments = verse.segments
        .map((segment) => segment.map(Number))
        .filter(
          (segment): segment is [number, number, number] =>
            segment.length === 3 && segment.every(Number.isFinite),
        );
      const highest = Math.max(0, ...segments.map(([word]) => word));
      const map = wordMap(
        textsByVerse.get(`${verse.surah_number}:${verse.ayah_number}`) ?? [],
        highest,
      );
      if (!map) return [];
      return [
        {
          recitation,
          surah: verse.surah_number,
          ayah: verse.ayah_number,
          segments: segments.flatMap(
            ([word, start, end]): [number, number, number][] => {
              const mapped = map[word - 1];
              return mapped ? [[mapped, start, end]] : [];
            },
          ),
        },
      ];
    });
    console.log(
      `recitation ${recitation}: ${rows.length} of ${verses.length} verses timed, audio ${[...bases][0]}`,
    );
    return rows;
  }),
);

const manifest = manifestFile.parse(
  JSON.parse(await Bun.file(`${QUL_DIR}/manifest.json`).text()),
);
const translationList = [
  ...manifest.resources.flatMap((resource) => {
    const language = TRANSLATION_LANGUAGES.find(([tag]) =>
      resource.tags.includes(tag),
    );
    const wanted =
      resource.category === "translation" &&
      resource.files.length > 0 &&
      !/wbw|word by word/iu.test(resource.name) &&
      !DUPLICATE_TRANSLATIONS.includes(resource.id);
    return wanted && language
      ? [
          {
            id: resource.id,
            name: decodeEntities(resource.name),
            lang: language[1],
            kind: "translation" as const,
            category: "translation",
          },
        ]
      : [];
  }),
  {
    id: QUL_VERSE_TRANSLITERATION,
    name: "Transliteration",
    lang: "en",
    kind: "transliteration" as const,
    category: "transliteration",
  },
];
const translationRows = (
  await Promise.all(
    translationList.map(async (translation) => {
      const file = translationFile.parse(
        await unzipJson(
          await resourcePath(translation.category, translation.id),
        ),
      );
      const rows = Object.entries(file).flatMap(([key, entry]) => {
        const [surah = 0, ayah = 0] = key.split(":").map(Number);
        const { text, footnotes } = flatten(entry);
        return surah && ayah && text
          ? [{ translation: translation.id, surah, ayah, text, footnotes }]
          : [];
      });
      if (rows.length < QURAN_VERSES)
        console.log(
          `translation ${translation.id}: only ${rows.length} verses`,
        );
      return rows;
    }),
  )
).flat();
console.log(
  `translations: ${translationList.length - 1} plus transliteration, ${translationRows.length} verses`,
);

await db.transaction(async (tx) => {
  await tx.delete(verseWords);
  await tx.delete(recitationTimings);
  await tx.delete(wordMeanings);
  await tx.delete(verseTranslations);
  await tx.delete(translations);
  await Promise.all(
    chunks(wordRows).map((rows) => tx.insert(verseWords).values(rows)),
  );
  await Promise.all(
    chunks(timingRows.flat()).map((rows) =>
      tx.insert(recitationTimings).values(rows),
    ),
  );
  await Promise.all(
    chunks(meaningRows).map((rows) => tx.insert(wordMeanings).values(rows)),
  );
  await tx.insert(translations).values(
    translationList.map(({ id, name, lang, kind }) => ({
      id,
      name,
      lang,
      kind,
    })),
  );
  await Promise.all(
    chunks(translationRows).map((rows) =>
      tx.insert(verseTranslations).values(rows),
    ),
  );
});

const tafsirRows = (
  await Promise.all(
    QUL_TAFSIRS.map(async (tafsir) => {
      const entries = new Map(
        Object.entries(
          tafsirFile.parse(
            await unzipJson(await resourcePath("tafsir", tafsir.id)),
          ),
        ),
      );
      const ownerOf = (key: string, depth = 0): string => {
        const entry = entries.get(key);
        return entry && "owner" in entry && depth < 20
          ? ownerOf(entry.owner, depth + 1)
          : key;
      };
      const passages = new Map<
        string,
        { owner: string; surah: number; ayahs: number[] }
      >();
      for (const key of entries.keys()) {
        const owner = ownerOf(key);
        const [surah, ayah] = key.split(":").map(Number);
        const id = `${owner} ${surah}`;
        const passage = passages.get(id) ?? { owner, surah, ayahs: [] };
        passages.set(id, { ...passage, ayahs: [...passage.ayahs, ayah] });
      }
      const rows = await Promise.all(
        [...passages.values()].map(async ({ owner, surah, ayahs }) => {
          const entry = entries.get(owner);
          if (!entry || "owner" in entry) return [];
          const body = await cleanHtml(entry.text);
          const covered = ayahs.filter(Number.isFinite);
          return body && surah && covered.length > 0
            ? [
                {
                  tafsir: tafsir.id,
                  surah,
                  fromAyah: Math.min(...covered),
                  toAyah: Math.max(...covered),
                  body,
                },
              ]
            : [];
        }),
      );
      console.log(
        `tafsir ${tafsir.id} ${tafsir.name}: ${rows.flat().length} passages`,
      );
      return rows.flat();
    }),
  )
).flat();

await db.transaction(async (tx) => {
  await tx.delete(tafsirTexts);
  await tx.delete(tafsirs);
  await tx.insert(tafsirs).values([...QUL_TAFSIRS]);
  await Promise.all(
    chunks(tafsirRows, TAFSIR_CHUNK_SIZE).map((rows) =>
      tx.insert(tafsirTexts).values(rows),
    ),
  );
});

console.log(
  `Loaded words for ${wordRows.length} verses (${words.length} words), ${meaningRows.length} verses of word meanings in ${WORD_MEANINGS.length} languages and ${timingRows.flat().length} timed verses for ${TIMED_RECITATIONS.length} recitations`,
);
process.exit(0);
