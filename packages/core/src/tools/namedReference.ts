import { z } from "zod";

type Entry = {
  names: readonly string[];
  quran?: { surah: number; from?: number; to?: number };
  hadith?: string;
};

const ENTRIES = [
  {
    names: [
      "al fatiha",
      "al fatihah",
      "fatiha",
      "fatihah",
      "the opening",
      "umm al kitab",
      "الفاتحة",
    ],
    quran: { surah: 1 },
  },
  {
    names: [
      "ayat al kursi",
      "ayat ul kursi",
      "ayatul kursi",
      "ayah al kursi",
      "throne verse",
      "verse of the throne",
      "آية الكرسي",
    ],
    quran: { surah: 2, from: 255 },
  },
  {
    names: [
      "surah al baqarah",
      "surah baqarah",
      "surah al baqara",
      "surah baqara",
      "سورة البقرة",
    ],
    quran: { surah: 2 },
  },
  {
    names: [
      "last two verses of al baqarah",
      "last two verses of surah al baqarah",
      "last two ayat of al baqarah",
      "last two verses of baqarah",
      "amana rasul",
      "amanar rasul",
    ],
    quran: { surah: 2, from: 285, to: 286 },
  },
  {
    names: [
      "light verse",
      "verse of light",
      "ayat an nur",
      "ayat al nur",
      "آية النور",
    ],
    quran: { surah: 24, from: 35 },
  },
  {
    names: ["verse of debt", "ayat ad dayn", "ayat al dayn", "longest verse"],
    quran: { surah: 2, from: 282 },
  },
  {
    names: ["verse of righteousness", "ayat al birr"],
    quran: { surah: 2, from: 177 },
  },
  {
    names: ["no compulsion in religion", "ayat al ikrah"],
    quran: { surah: 2, from: 256 },
  },
  {
    names: ["verse of fasting", "ayat as siyam"],
    quran: { surah: 2, from: 183 },
  },
  {
    names: ["verse of wudu", "wudu verse", "ayat al wudu"],
    quran: { surah: 5, from: 6 },
  },
  {
    names: ["verse of inheritance", "ayat al mawarith", "inheritance verses"],
    quran: { surah: 4, from: 11, to: 12 },
  },
  {
    names: ["verse of the sword", "ayat as sayf"],
    quran: { surah: 9, from: 5 },
  },
  {
    names: ["people of understanding verses", "ayat ulil albab"],
    quran: { surah: 3, from: 190, to: 194 },
  },
  {
    names: ["dua of yunus", "prayer of yunus", "dua of jonah"],
    quran: { surah: 21, from: 87 },
  },
  {
    names: [
      "last three verses of al hashr",
      "last three verses of surah al hashr",
    ],
    quran: { surah: 59, from: 22, to: 24 },
  },
  {
    names: ["first revelation", "first verses revealed"],
    quran: { surah: 96, from: 1, to: 5 },
  },
  {
    names: ["night journey verse", "verse of isra"],
    quran: { surah: 17, from: 1 },
  },
  {
    names: [
      "surah yasin",
      "surah yaseen",
      "ya sin",
      "yasin",
      "yaseen",
      "heart of the quran",
      "سورة يس",
    ],
    quran: { surah: 36 },
  },
  {
    names: [
      "surah al kahf",
      "surah kahf",
      "al kahf",
      "sura of the cave",
      "سورة الكهف",
    ],
    quran: { surah: 18 },
  },
  {
    names: [
      "first ten verses of al kahf",
      "first ten verses of kahf",
      "first ten verses of surah kahf",
      "first ten verses of surah al kahf",
      "first ten ayat of surah al kahf",
    ],
    quran: { surah: 18, from: 1, to: 10 },
  },
  {
    names: [
      "last ten verses of al kahf",
      "last ten verses of kahf",
      "last ten verses of surah kahf",
      "last ten verses of surah al kahf",
      "last ten ayat of surah al kahf",
    ],
    quran: { surah: 18, from: 101, to: 110 },
  },
  { names: ["surah maryam", "surah mary"], quran: { surah: 19 } },
  { names: ["surah yusuf", "surah joseph"], quran: { surah: 12 } },
  { names: ["surah luqman"], quran: { surah: 31 } },
  {
    names: ["surah as sajdah", "surah sajdah", "alif lam meem sajdah"],
    quran: { surah: 32 },
  },
  { names: ["surah ad dukhan", "surah dukhan"], quran: { surah: 44 } },
  { names: ["surah al hujurat", "surah hujurat"], quran: { surah: 49 } },
  {
    names: ["surah ar rahman", "surah rahman", "سورة الرحمن"],
    quran: { surah: 55 },
  },
  {
    names: ["surah al waqiah", "surah waqiah", "surah waqia"],
    quran: { surah: 56 },
  },
  {
    names: ["surah al mulk", "surah mulk", "surah tabarak", "سورة الملك"],
    quran: { surah: 67 },
  },
  { names: ["surah ad duha", "surah duha"], quran: { surah: 93 } },
  {
    names: ["surah ash sharh", "surah inshirah", "surah alam nashrah"],
    quran: { surah: 94 },
  },
  { names: ["surah at tin", "surah tin"], quran: { surah: 95 } },
  {
    names: ["surah al alaq", "surah alaq", "surah iqra"],
    quran: { surah: 96 },
  },
  { names: ["surah al qadr", "surah qadr"], quran: { surah: 97 } },
  { names: ["surah at takathur", "surah takathur"], quran: { surah: 102 } },
  { names: ["surah al asr", "surah asr"], quran: { surah: 103 } },
  { names: ["surah al fil", "surah fil"], quran: { surah: 105 } },
  { names: ["surah quraysh", "surah quraish"], quran: { surah: 106 } },
  { names: ["surah al maun", "surah maun"], quran: { surah: 107 } },
  {
    names: [
      "surah al kawthar",
      "surah kawthar",
      "surah kauthar",
      "سورة الكوثر",
    ],
    quran: { surah: 108 },
  },
  { names: ["surah al kafirun", "surah kafirun"], quran: { surah: 109 } },
  { names: ["surah an nasr", "surah nasr"], quran: { surah: 110 } },
  {
    names: ["surah al masad", "surah masad", "surah lahab"],
    quran: { surah: 111 },
  },
  {
    names: [
      "surah al ikhlas",
      "surah ikhlas",
      "qul huwa allahu ahad",
      "سورة الإخلاص",
    ],
    quran: { surah: 112 },
  },
  { names: ["surah al falaq", "surah falaq"], quran: { surah: 113 } },
  { names: ["surah an nas", "surah nas"], quran: { surah: 114 } },
  {
    names: [
      "hadith of intentions",
      "hadith of intention",
      "hadith of niyyah",
      "actions are by intentions",
      "innama al amal bin niyyat",
    ],
    hadith: "bukhari:1",
  },
  {
    names: ["hadith of jibril", "hadith of gabriel", "hadith jibril"],
    hadith: "nawawi:2",
  },
  {
    names: ["hadith of the five pillars", "islam is built on five"],
    hadith: "bukhari:8",
  },
  {
    names: [
      "love for your brother what you love for yourself",
      "hadith of loving for your brother",
    ],
    hadith: "bukhari:13",
  },
  {
    names: [
      "seven shaded by allah",
      "hadith of the seven shaded",
      "seven whom allah will shade",
      "seven people allah will shade",
    ],
    hadith: "bukhari:660",
  },
  {
    names: ["religion is sincerity", "ad din an nasiha", "hadith of sincerity"],
    hadith: "muslim:55a",
  },
] as const satisfies readonly Entry[];

export const namedReferenceInput = z.object({ name: z.string().trim().min(1) });

const NUMBERS = new Map([
  ["2", "two"],
  ["3", "three"],
  ["10", "ten"],
]);

const normalize = (text: string) =>
  text
    .normalize("NFKD")
    .replaceAll(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .replaceAll(/\b(?:surat|sura|soorah)\b/gu, "surah")
    .replaceAll(/\b\d+\b/gu, (digits) => NUMBERS.get(digits) ?? digits)
    .trim();

export const namedReference = (input: z.input<typeof namedReferenceInput>) => {
  const { name } = namedReferenceInput.parse(input);
  const padded = ` ${normalize(name)} `;
  const found = ENTRIES.flatMap((entry) => {
    const [longest] = entry.names
      .map(normalize)
      .filter((alias) => padded.includes(` ${alias} `))
      .toSorted((a, b) => b.length - a.length);
    return longest === undefined ? [] : [{ entry, alias: longest }];
  });
  return {
    matches: found
      .filter(
        ({ alias }) =>
          !found.some(
            (other) =>
              other.alias !== alias &&
              ` ${other.alias} `.includes(` ${alias} `),
          ),
      )
      .map(({ entry }) => entry),
  };
};
