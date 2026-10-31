import { z } from "zod";
import type { quranVerse } from "../../apps/data/src/schema";
import { download, tanzilSource } from "./sources";

const tanzilUrl = (type: string) =>
  `https://tanzil.net/pub/download/index.php?quranType=${type}&outType=txt-2&agree=true`;

const numeric = z.coerce.number();

const surahTag = z.object({
  index: numeric,
  ayas: numeric,
  name: z.string(),
  tname: z.string(),
  ename: z.string(),
  type: z.enum(["Meccan", "Medinan"]),
  order: numeric,
  rukus: numeric,
});

const startTag = z.object({ index: numeric, sura: numeric, aya: numeric });

const sajdaTag = startTag.extend({ type: z.enum(["recommended", "obligatory"]) });

const attributesOf = (tag: string) =>
  Object.fromEntries(
    [...tag.matchAll(/(\w+)="([^"]*)"/g)].flatMap(([, name, value]) =>
      name && value !== undefined ? [[name, value]] : [],
    ),
  );

const elements = <Schema extends z.ZodType>(xml: string, name: string, schema: Schema) =>
  [...xml.matchAll(new RegExp(`<${name} ([^>]*?)/>`, "g"))].map(([, tag = ""]) =>
    schema.parse(attributesOf(tag)),
  );

const readText = async (path: string) => {
  const text = await Bun.file(path).text();
  const verses = new Map<string, string>();
  for (const line of text.split("\n")) {
    const match = /^(\d+)\|(\d+)\|(.*)$/.exec(line);
    if (match) verses.set(`${match[1]}:${match[2]}`, match[3] ?? "");
  }
  const version = /Version ([\d.]+)\)/.exec(text)?.[1];
  const year = /2007-(\d{4})/.exec(text)?.[1];
  if (!version || !year) throw new Error(`no Tanzil notice in ${path}`);
  return { verses, version, year, notice: text.slice(text.indexOf("#====")).trim() };
};

type Start = z.infer<typeof startTag>;

const startAt = (starts: Start[]) => {
  let current = 0;
  return (surah: number, ayah: number) => {
    for (;;) {
      const next = starts[current + 1];
      if (!next || next.sura > surah || (next.sura === surah && next.aya > ayah)) break;
      current++;
    }
    return starts[current]?.index ?? 0;
  };
};

export const loadTanzil = async (rawDir: string) => {
  const [uthmani, simple, metadataPath] = await Promise.all([
    download(tanzilUrl("uthmani"), `${rawDir}/tanzil/uthmani.txt`).then(readText),
    download(tanzilUrl("simple-clean"), `${rawDir}/tanzil/simple-clean.txt`).then(readText),
    download(
      "https://tanzil.net/res/text/metadata/quran-data.xml",
      `${rawDir}/tanzil/quran-data.xml`,
    ),
  ]);
  const xml = await Bun.file(metadataPath).text();
  const surahs = elements(xml, "sura", surahTag);
  const juzAt = startAt(elements(xml, "juz", startTag));
  const pageAt = startAt(elements(xml, "page", startTag));
  const quarterAt = startAt(elements(xml, "quarter", startTag));
  const sajdas = elements(xml, "sajda", sajdaTag);
  const verses: z.infer<typeof quranVerse>[] = [];
  for (const surah of surahs) {
    for (let ayah = 1; ayah <= surah.ayas; ayah++) {
      const key = `${surah.index}:${ayah}`;
      const arabic = { uthmani: uthmani.verses.get(key), simple: simple.verses.get(key) };
      if (arabic.uthmani === undefined || arabic.simple === undefined) {
        throw new Error(`Tanzil text is missing verse ${key}`);
      }
      const quarter = quarterAt(surah.index, ayah);
      verses.push({
        surah: surah.index,
        ayah,
        juz: juzAt(surah.index, ayah),
        page: pageAt(surah.index, ayah),
        hizb: Math.ceil(quarter / 4),
        quarter,
        sajda:
          sajdas.find((entry) => entry.sura === surah.index && entry.aya === ayah)?.type ?? null,
        arabic: { uthmani: arabic.uthmani, simple: arabic.simple },
      });
    }
  }
  if (verses.length !== uthmani.verses.size || verses.length !== simple.verses.size) {
    throw new Error(`Tanzil has ${uthmani.verses.size} verses, metadata expects ${verses.length}`);
  }
  return {
    surahs,
    verses,
    source: tanzilSource(uthmani.version, uthmani.year),
    notices: [uthmani.notice, simple.notice],
  };
};
