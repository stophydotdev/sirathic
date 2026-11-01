import { db } from "@sirathic/db";
import { hadiths } from "@sirathic/db/schema";
import { Glob } from "bun";
import { z } from "zod";
import { hadithKey } from "./hadithKey";

const MOSTLY_UNCHECKED = 0.9;
const TEXT_MATCH_BOOKS = new Set(["muslim", "malik", "darimi"]);
const ATTRIBUTION_CHARS = 60;

const pagesDir = z.string().parse(Bun.env.SUNNAH_PAGES);
const summaryFile = z.string().parse(Bun.argv[2]);
const outFile = new URL("../packages/core/src/tools/unverifiedHadith.json", import.meta.url);
const letteredFile = new URL("../packages/core/src/tools/sunnahLettered.json", import.meta.url);
const malikFile = new URL("../packages/core/src/tools/malikNumbers.json", import.meta.url);

const copies = new Map<string, Set<string>>();
const bookTexts = new Map<string, Set<string>>();
const letteredAs = new Map<string, string>();
const numbersOfText = new Map<string, Set<string>>();

const dottedForms = (base: string, letter: string) => {
  const place = letter.charCodeAt(0) - 96;
  if (place < 2) return [];
  const twoDigit = place === 10 ? "1" : String(place).padStart(2, "0");
  return [...new Set([`${base}.${place}`, `${base}.${twoDigit}`])];
};

const addCopy = (book: string, number: string | null, text: string) => {
  const key = hadithKey(text);
  if (key === "") return;
  const lettered = /^(\d+)([a-z])$/u.exec(number ?? "");
  const dotted = lettered ? dottedForms(lettered[1] ?? "", lettered[2] ?? "") : [];
  for (const form of dotted) letteredAs.set(`${book}:${form}`, number ?? "");
  const ids = [...(number === null ? [] : [number]), ...dotted].map((id) => `${book}:${id}`);
  for (const id of ids) copies.set(id, (copies.get(id) ?? new Set<string>()).add(key));
  bookTexts.set(book, (bookTexts.get(book) ?? new Set<string>()).add(key));
  if (number !== null) {
    const at = `${book}:${key}`;
    numbersOfText.set(at, (numbersOfText.get(at) ?? new Set<string>()).add(number));
  }
};

const ARABIC_LETTERS = /[ء-ي]/gu;
const LATIN_LETTERS = /[A-Za-z]/gu;
const SHORT_LETTERS = 20;
const referenceLink = /\*\*Reference\*\*\s*\|\s*:\s*\[([^\]]*)\]\(([^)]*)\)/u;
const arabicReference = /Arabic reference\s*\|\s*:\s*Book \d+, Hadith (\d+)/u;

const files = await Array.fromAsync(new Glob("*_*.md").scan(pagesDir));
const pages = await Promise.all(
  files.map(async (file) => ({
    book: file.split("_")[0] ?? "",
    text: await Bun.file(`${pagesDir}/${file}`).text(),
  })),
);

const copiesOf = (lines: readonly { text: string; short: boolean }[]) => {
  const long = lines.filter((line) => !line.short).map((line) => line.text);
  const lastLong = lines.findLastIndex((line) => !line.short);
  return [
    ...long.map((_, from) => long.slice(from).join(" ")),
    ...lines.slice(0, Math.max(lastLong, 0) + 1).map((_, from) =>
      lines
        .slice(from)
        .map((line) => line.text)
        .join(" "),
    ),
  ];
};

for (const { book, text } of pages) {
  let pending: { text: string; short: boolean }[] = [];
  for (const paragraph of text.split(/\n\s*\n/u)) {
    if (!paragraph.startsWith("|")) {
      const plain = paragraph.replace(/\[((?:\\.|[^\]\\])*)\]\([^)]*\)/gu, "$1").trim();
      const arabic = plain.match(ARABIC_LETTERS)?.length ?? 0;
      const short = arabic <= SHORT_LETTERS;
      if (short && plain.startsWith("باب")) continue;
      if (arabic > (plain.match(LATIN_LETTERS)?.length ?? 0)) {
        pending.push({ text: plain, short });
      } else if (/[A-Za-z]/u.test(plain)) {
        pending = [];
      }
      continue;
    }
    const link = referenceLink.exec(paragraph);
    const number = link
      ? (/\/[a-z0-9]+:(\d+[a-z]?)(?:-\d+[a-z]?)?$/u.exec(link[2] ?? "")?.[1] ??
        /(\d+[a-z]?)$/u.exec(link[1] ?? "")?.[1] ??
        null)
      : (arabicReference.exec(paragraph)?.[1] ?? null);
    const isReference = link !== null || /Sunnah\.com reference|Arabic reference/u.test(paragraph);
    if (!isReference || pending.length === 0) continue;
    for (const copy of new Set(copiesOf(pending))) addCopy(book, number, copy);
    pending = [];
  }
}

const rows = await db.transaction(
  (tx) =>
    tx
      .select({
        id: hadiths.id,
        book: hadiths.book,
        source: hadiths.source,
        textAr: hadiths.textAr,
      })
      .from(hadiths),
  { accessMode: "read only" },
);

type Verdict = "checked" | "textOnly" | "noArabic" | "noCopy" | "differs";

const verdictOf = ({ id, book, textAr }: (typeof rows)[number]): Verdict => {
  const key = hadithKey(textAr ?? "");
  if (key === "") return "noArabic";
  const same = copies.get(id);
  if (same?.has(key)) return "checked";
  if (
    [...(same ?? [])].some(
      (copy) =>
        key.startsWith(copy) &&
        key.startsWith("رواه", copy.length) &&
        key.length - copy.length <= ATTRIBUTION_CHARS &&
        !/روايه|قال|عن|زاد|فيه/u.test(key.slice(copy.length)),
    )
  ) {
    return "checked";
  }
  if (TEXT_MATCH_BOOKS.has(book) && bookTexts.get(book)?.has(key)) return "textOnly";
  return same === undefined ? "noCopy" : "differs";
};

const verdicts = rows.map(verdictOf);
const isChecked = (verdict: Verdict) => verdict === "checked" || verdict === "textOnly";

const excluded = new Map<string, string[]>();
const rowsPerBook = new Map<string, number>();
for (const [at, row] of rows.entries()) {
  rowsPerBook.set(row.book, (rowsPerBook.get(row.book) ?? 0) + 1);
  if (isChecked(verdicts[at] ?? "noCopy")) continue;
  const list = excluded.get(row.book) ?? [];
  list.push(row.id);
  excluded.set(row.book, list);
}
const books = [...excluded]
  .filter(([book, list]) => list.length >= (rowsPerBook.get(book) ?? 0) * MOSTLY_UNCHECKED)
  .map(([book]) => book)
  .toSorted();
const ids = Object.fromEntries(
  [...excluded]
    .filter(([book]) => !books.includes(book))
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([book, list]) => [
      book,
      list
        .toSorted()
        .map((id) => id.slice(book.length + 1))
        .join(" "),
    ]),
);

const summary: Record<string, Record<Verdict | "rows" | "droppedWithBook", number>> = {};
for (const [at, row] of rows.entries()) {
  const verdict = verdicts[at] ?? "noCopy";
  const line = (summary[`${row.book} (${row.source})`] ??= {
    rows: 0,
    checked: 0,
    textOnly: 0,
    noArabic: 0,
    noCopy: 0,
    differs: 0,
    droppedWithBook: 0,
  });
  line.rows++;
  line[verdict]++;
  if (isChecked(verdict) && books.includes(row.book)) line.droppedWithBook++;
}

await Bun.write(outFile, `${JSON.stringify({ books, ids })}\n`);
const lettered = Object.fromEntries(
  rows.flatMap((row, at) => {
    const sunnah = letteredAs.get(row.id);
    return sunnah !== undefined && isChecked(verdicts[at] ?? "noCopy") ? [[row.id, sunnah]] : [];
  }),
);
await Bun.write(letteredFile, `${JSON.stringify(lettered)}\n`);
const nearest = (own: number, numbers: Iterable<string>) =>
  [...numbers].toSorted((a, b) => Math.abs(Number(a) - own) - Math.abs(Number(b) - own))[0];
const malikNumbers = Object.fromEntries(
  rows.flatMap((row, at) => {
    if (row.book !== "malik" || verdicts[at] !== "textOnly") return [];
    const own = row.id.slice(row.id.indexOf(":") + 1);
    const sunnah = nearest(
      Number(own),
      numbersOfText.get(`malik:${hadithKey(row.textAr ?? "")}`) ?? [],
    );
    return sunnah === undefined || sunnah === own ? [] : [[row.id, sunnah]];
  }),
);
await Bun.write(malikFile, `${JSON.stringify(malikNumbers)}\n`);
await Bun.write(summaryFile, JSON.stringify(summary, null, 2));
console.log(
  `books excluded whole: ${books.join(", ")}; ids listed: ${Object.values(ids).join(" ").split(" ").length}`,
);
process.exit(0);
