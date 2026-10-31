import { readdirSync, readFileSync } from "node:fs";
import type { CollectionSlug } from "../../apps/data/src/resolve";

export type SecondCopy = {
  numbers: string[];
  inBook: { book: number; hadith: number } | null;
  arabic: string;
};

const inBookKeys = [
  "In-book reference",
  "USC-MSA web (English) reference",
  "Arabic/English book reference",
  "Sunnah.com reference",
];

const referenceRow = /^\| (.*?) \| : (.*) \|$/;

const arabicLetters = /[\u0600-\u06FF]/g;

const latinLetters = /[A-Za-z]/g;

const isArabic = (paragraph: string) =>
  (paragraph.match(arabicLetters)?.length ?? 0) > (paragraph.match(latinLetters)?.length ?? 0);

const referenceNumbers = (row: string) => {
  const label = /\[(.*?)\]\(https:\/\/sunnah\.com\/[a-z0-9]+:([0-9a-z]+)\)/.exec(row);
  const listed = [...(label?.[1] ?? "").matchAll(/(\d+)(?: ?([a-z]))?(?=,|\s*$)/g)].map(
    ([, digits = "", letter = ""]) => `${digits}${letter}`,
  );
  return listed.length > 0 ? listed : label?.[2] ? [label[2]] : [];
};

const parsePage = (text: string) => {
  const entries: SecondCopy[] = [];
  const lines = text.split("\n");
  let paragraphs: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (referenceRow.test(line) && !line.startsWith("| **Grade")) {
      const rows = new Map<string, string>();
      while ((lines[index] ?? "").startsWith("|")) {
        const row = referenceRow.exec(lines[index] ?? "");
        if (row?.[1] && row[2]) rows.set(row[1].replaceAll("*", ""), row[2]);
        index++;
      }
      const arabic = paragraphs
        .slice(paragraphs.findLastIndex((paragraph) => !isArabic(paragraph)) + 1)
        .join(" ");
      const key = inBookKeys.find((name) => rows.has(name));
      const place = /Book (\d+), Hadith (\d+)/.exec(rows.get(key ?? "") ?? "");
      entries.push({
        numbers: referenceNumbers(rows.get("Reference") ?? ""),
        inBook: place ? { book: Number(place[1]), hadith: Number(place[2]) } : null,
        arabic,
      });
      paragraphs = [];
      continue;
    }
    if (/\p{L}/u.test(line) && !line.startsWith("|"))
      paragraphs.push(line.replace(/\[((?:\\.|[^\]\\])*)\]\([^)]*\)/g, "$1"));
    index++;
  }
  return entries;
};

export const loadSunnah = (dir: string, slugs: readonly CollectionSlug[]) => {
  const names = readdirSync(dir);
  return new Map(
    slugs.map((slug) => {
      const pages = names.filter((name) => new RegExp(`^${slug}_\\d+\\.md$`).test(name));
      return [slug, pages.flatMap((name) => parsePage(readFileSync(`${dir}/${name}`, "utf8")))];
    }),
  );
};
