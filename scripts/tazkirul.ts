import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const TAZKIRUL_PDF =
  "https://www.cpsglobal.org/sites/default/files/2025-01/Quran-Commentary.pdf";

const NOTE_SIZE = 11;
const VERSE_SIZE = 15;
const TITLE_SIZE = 20;
const COLUMN_WIDTH = 300;
const SAME_LINE = 4;
const PARAGRAPH_GAP = 21;
const INDEX_HEADING = "I N D E X";
const BISMILLAH = /^(In the name of God,?|the Most Gracious, the Most Merciful)$/u;
const ENTITIES = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
]);

type Item = {
  top: number;
  left: number;
  right: number;
  size: number;
  text: string;
};

type Verses = { surah: number; from: number; to: number };

type Note = { page: number; letter: string; verses: Verses };

type Passage = Verses & { commentary: string };

const decode = (html: string) =>
  html
    .replaceAll(/<[^>]+>/gu, "")
    .replaceAll(/&(#\d+|\w+);/gu, (entity, name: string) =>
      name.startsWith("#")
        ? String.fromCodePoint(Number(name.slice(1)))
        : (ENTITIES.get(name) ?? entity),
    );

const linesOf = (page: string, sizes: Map<string, number>) => {
  const items = [
    ...page.matchAll(
      /<text top="(\d+)" left="(\d+)" width="(\d+)" height="\d+" font="(\d+)">(.*?)<\/text>/gu,
    ),
  ]
    .map(([, top, left, width, font = "", html = ""]) => ({
      top: Number(top),
      left: Number(left),
      right: Number(left) + Number(width),
      size: sizes.get(font) ?? 0,
      text: decode(html),
    }))
    .filter((item) => item.text.trim() !== "")
    .toSorted((a, b) => a.top - b.top || a.left - b.left);
  const lines: Item[][] = [];
  for (const item of items) {
    const line = lines.at(-1);
    if (line !== undefined && item.top - (line[0]?.top ?? 0) <= SAME_LINE) {
      line.push(item);
    } else {
      lines.push([item]);
    }
  }
  return lines.map((line) => line.toSorted((a, b) => a.left - b.left));
};

const textOf = (items: Item[]) =>
  items
    .reduce((text, item, index) => {
      const previous = items[index - 1];
      const spaced =
        previous !== undefined &&
        item.left - previous.right > 1 &&
        !/\s$/u.test(text) &&
        !/^\s/u.test(item.text);
      return `${text}${spaced ? " " : ""}${item.text}`;
    }, "")
    .replaceAll(/\s+/gu, " ")
    .trim();

const isNote = (item: Item) => item.size <= NOTE_SIZE;

const isVerseNumber = (item: Item) => isNote(item) && /^\d+$/u.test(item.text.trim());

const letterOf = (item: Item) =>
  isNote(item) ? /^([a-z])\1*$/u.exec(item.text.trim())?.[1] : undefined;

const widen = (verses: Verses, notes: Note[]) => {
  verses.from = Math.min(verses.from, ...notes.map((note) => note.verses.from));
  verses.to = Math.max(verses.to, ...notes.map((note) => note.verses.to));
};

const joinHyphens = (passages: Passage[]) => {
  const words = new Set(
    passages.flatMap(
      ({ commentary }) => commentary.toLowerCase().match(/[a-z]+(?:-[a-z]+)*/gu) ?? [],
    ),
  );
  return passages.map((passage) =>
    Object.assign(passage, {
      commentary: passage.commentary.replaceAll(
        /([A-Za-z]+)- ([a-z]+)/gu,
        (_, head: string, tail: string) =>
          words.has(`${head}${tail}`.toLowerCase()) && !words.has(`${head}-${tail}`.toLowerCase())
            ? `${head}${tail}`
            : `${head}-${tail}`,
      ),
    }),
  );
};

const tazkirulPassages = (xml: string) => {
  const sizes = new Map(
    [...xml.matchAll(/<fontspec id="(\d+)" size="(\d+)"/gu)].map(([, id = "", size]) => [
      id,
      Number(size),
    ]),
  );
  const passages: Passage[] = [];
  const problems: string[] = [];
  let pending: Note[] = [];
  let surah = 0;
  let lastVerse = 0;
  let from: number | undefined;
  let open: { passage: Passage; page: number; top: number | undefined } | undefined;
  const start = (verses: Verses, commentary: string) => {
    const last = passages.at(-1);
    if (last?.surah === verses.surah && last.from === verses.from && last.to === verses.to) {
      last.commentary += `\n\n${commentary}`;
      return last;
    }
    const passage = { ...verses, commentary };
    passages.push(passage);
    return passage;
  };
  const closeSurah = () => {
    const last = passages.at(-1);
    if (last === undefined || last.surah !== surah) return;
    widen(last, pending);
    pending = [];
  };
  for (const [page, body] of xml.split("<page ").slice(1).entries()) {
    if (open !== undefined) {
      const { passage } = open;
      widen(
        passage,
        pending.filter((note) => note.page === open?.page),
      );
      pending = pending.filter((note) => note.page !== open?.page);
      open.top = undefined;
    }
    for (const line of linesOf(body, sizes)) {
      const [first] = line;
      const text = textOf(line);
      if (first === undefined) continue;
      if (text === INDEX_HEADING) {
        closeSurah();
        return { passages: joinHyphens(passages), problems };
      }
      if (line.some((item) => /^\d+: ?\d+$/u.test(item.text.trim()))) continue;
      if (/^\d+$/u.test(text) && !isNote(first)) continue;
      if (first.size >= TITLE_SIZE) {
        const number = /^(\d+)\./u.exec(text)?.[1];
        if (number === undefined) continue;
        closeSurah();
        surah = Number(number);
        lastVerse = 0;
        from = 1;
        open = undefined;
        continue;
      }
      if (surah === 0 || BISMILLAH.test(text)) continue;
      const letter = letterOf(first);
      if (letter !== undefined) {
        const at = pending.findLastIndex((note) => note.letter === letter);
        const rest = textOf(line.slice(1));
        if (at !== -1) {
          const notes = pending.slice(0, at + 1);
          pending = pending.slice(at + 1);
          const verses = { surah, from: lastVerse, to: 0 };
          widen(verses, notes);
          open = { passage: start(verses, rest), page, top: first.top };
        } else if (open !== undefined) {
          open.passage.commentary += `\n\n${rest}`;
          open.top = first.top;
        } else if (from !== undefined) {
          const verses = { surah, from, to: lastVerse };
          from = undefined;
          open = { passage: start(verses, rest), page, top: first.top };
        } else {
          problems.push(`page ${page + 1}: commentary ${letter} has no note`);
        }
        continue;
      }
      const span = (line.at(-1)?.right ?? 0) - first.left;
      const isVerseLine =
        line.some(isVerseNumber) ||
        (line.some((item) => item.size >= VERSE_SIZE) && span <= COLUMN_WIDTH);
      if (isVerseLine) {
        for (const item of line) {
          const note = letterOf(item);
          if (isVerseNumber(item)) {
            lastVerse = Number(item.text.trim());
            from ??= lastVerse;
          } else if (note !== undefined) {
            const verses = { surah, from: from ?? lastVerse, to: lastVerse };
            const repeated = pending.find((other) => other.page === page && other.letter === note);
            if (repeated === undefined) pending.push({ page, letter: note, verses });
            else widen(repeated.verses, [{ page, letter: note, verses }]);
            from = undefined;
          } else if (lastVerse > 0) {
            from ??= lastVerse;
          }
        }
        continue;
      }
      if (open === undefined) {
        problems.push(`page ${page + 1}: commentary text with no note: ${text.slice(0, 60)}`);
        continue;
      }
      const breaks = open.top !== undefined && first.top - open.top > PARAGRAPH_GAP;
      open.passage.commentary += `${breaks ? "\n\n" : " "}${text}`;
      open.top = first.top;
    }
  }
  problems.push(`no "${INDEX_HEADING}" page after the last surah`);
  return { passages, problems };
};

export const tazkirulQuran = async () => {
  const response = await fetch(TAZKIRUL_PDF);
  if (!response.ok) throw new Error(`${TAZKIRUL_PDF} answered HTTP ${response.status}`);
  const folder = await mkdtemp(join(tmpdir(), "tazkirul-"));
  try {
    const pdf = join(folder, "book.pdf");
    await writeFile(pdf, new Uint8Array(await response.arrayBuffer()));
    const xml = await new Response(
      Bun.spawn(["pdftohtml", "-xml", "-i", "-stdout", pdf], {
        stderr: "ignore",
      }).stdout,
    ).text();
    const { passages, problems } = tazkirulPassages(xml);
    if (problems.length > 0) throw new Error(problems.join("\n"));
    return JSON.stringify(passages);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
};
