const collectionNames = {
  bukhari: ["bukhari", "sahih al bukhari", "sahih bukhari"],
  muslim: ["muslim", "sahih muslim"],
  abudawud: [
    "abudawud",
    "abu dawud",
    "abu daud",
    "abi dawud",
    "sunan abu dawud",
    "sunan abi dawud",
  ],
  tirmidhi: ["tirmidhi", "tirmizi", "jami at tirmidhi", "jami tirmidhi", "at tirmidhi"],
  nasai: ["nasai", "an nasai", "sunan an nasai", "sunan nasai"],
  ibnmajah: ["ibnmajah", "ibn majah", "ibn maja", "sunan ibn majah"],
  malik: ["malik", "muwatta", "muwatta malik", "muwatta imam malik", "al muwatta"],
  dehlawi: ["dehlawi", "shah waliullah", "forty hadith of shah waliullah dehlawi"],
  nawawi: ["nawawi", "nawawi40", "an nawawi", "40 hadith nawawi", "forty hadith nawawi"],
  qudsi: ["qudsi", "hadith qudsi", "40 hadith qudsi", "forty hadith qudsi"],
} as const satisfies Record<string, readonly string[]>;

export type CollectionSlug = keyof typeof collectionNames;

export const collectionSlugs = Object.keys(collectionNames).filter(
  (name): name is CollectionSlug => name in collectionNames,
);

const slugByName = new Map(
  collectionSlugs.flatMap((slug) =>
    collectionNames[slug].map((name): [string, CollectionSlug] => [name, slug]),
  ),
);

export type HadithRef =
  | { kind: "number"; collection: CollectionSlug; number: string }
  | { kind: "inBook"; collection: CollectionSlug; book: number; hadith: number };

const tidy = (text: string) =>
  text
    .toLowerCase()
    .replace(/['\u2018\u2019`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const inBookPattern = /^(.+?) book (\d+) hadith (\d+)$/;
const numberPattern = /^(.+?)(?: no| number| hadith)? (\d+(?: ?[a-z])?)$/;

export const parseHadithRef = (ref: string): HadithRef | null => {
  const text = tidy(ref);
  const inBook = inBookPattern.exec(text);
  const inBookCollection = slugByName.get(inBook?.[1] ?? "");
  if (inBook && inBookCollection) {
    return {
      kind: "inBook",
      collection: inBookCollection,
      book: Number(inBook[2]),
      hadith: Number(inBook[3]),
    };
  }
  const plain = numberPattern.exec(text);
  const collection = slugByName.get(plain?.[1] ?? "");
  if (plain?.[2] && collection) {
    return { kind: "number", collection, number: plain[2].replace(" ", "") };
  }
  return null;
};

export const blockOf = (number: string) => {
  const leading = /^\d+/.exec(number);
  return leading ? String(Math.floor(Number(leading[0]) / 100)) : "x";
};
