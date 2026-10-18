import { z } from "zod";

const API = "https://ar.wikisource.org/w/api.php";
const USER_AGENT = "Sirathic/0.1 (hussein@sirathic.com)";
const TITLES_PER_REQUEST = 50;
const HADITH_START = /^(?:====\s*(\d+)\s*====\s*$|(\d+)\s*[-–ـ]?\s+(?=\S))/u;

const listing = z.object({
  query: z.object({ allpages: z.array(z.object({ title: z.string() })) }),
  continue: z.object({ apcontinue: z.string() }).optional(),
});

const contents = z.object({
  query: z.object({
    pages: z.array(
      z.object({
        title: z.string(),
        revisions: z.array(
          z.object({
            slots: z.object({ main: z.object({ content: z.string() }) }),
          }),
        ),
      }),
    ),
  }),
});

type Entry = { number: number; url: string; raw: string };

type Hadith = {
  number: number;
  chapter: number;
  url: string;
  text: string;
  grade: string | null;
};

const query = async <Schema extends z.ZodType>(
  params: Record<string, string>,
  schema: Schema,
) => {
  const response = await fetch(API, {
    method: "POST",
    headers: { "User-Agent": USER_AGENT },
    body: new URLSearchParams({
      ...params,
      format: "json",
      formatversion: "2",
    }),
  });
  if (!response.ok) throw new Error(`${API} answered HTTP ${response.status}`);
  return schema.parse(await response.json());
};

const subpages = async (book: string, from?: string): Promise<string[]> => {
  const page = await query(
    {
      action: "query",
      list: "allpages",
      apprefix: `${book}/`,
      apnamespace: "0",
      aplimit: "500",
      apfilterredir: "nonredirects",
      apfrom: from ?? `${book}/`,
    },
    listing,
  );
  const titles = page.query.allpages.map(({ title }) => title);
  return page.continue === undefined
    ? titles
    : titles.concat(await subpages(book, page.continue.apcontinue));
};

const wikitexts = async (
  titles: string[],
): Promise<{ title: string; wikitext: string }[]> => {
  if (titles.length === 0) return [];
  const { query: result } = await query(
    {
      action: "query",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: titles.slice(0, TITLES_PER_REQUEST).join("|"),
    },
    contents,
  );
  const pages = result.pages.flatMap(({ title, revisions: [revision] }) =>
    revision === undefined
      ? []
      : [{ title, wikitext: revision.slots.main.content }],
  );
  return pages.concat(await wikitexts(titles.slice(TITLES_PER_REQUEST)));
};

const encodeSegment = (segment: string) =>
  encodeURIComponent(segment).replaceAll(
    /[!'()*]/gu,
    (character) =>
      `%${character.codePointAt(0)?.toString(16).toUpperCase() ?? ""}`,
  );

const pageUrl = (title: string) =>
  `https://ar.wikisource.org/wiki/${title.replaceAll(" ", "_").split("/").map(encodeSegment).join("/")}`;

const entriesOf = ({
  title,
  wikitext,
}: {
  title: string;
  wikitext: string;
}) => {
  const entries: Entry[] = [];
  let current: Entry | undefined;
  for (const line of wikitext.split("\n")) {
    const trimmed = line.trim();
    const start = HADITH_START.exec(trimmed);
    if (start !== null) {
      const [whole, heading, inline] = start;
      current = {
        number: Number(heading ?? inline),
        url:
          heading === undefined
            ? pageUrl(title)
            : `${pageUrl(title)}#${heading}`,
        raw: heading === undefined ? trimmed.slice(whole.length) : "",
      };
      entries.push(current);
    } else if (trimmed.startsWith("=")) {
      current = undefined;
    } else if (current !== undefined) {
      current.raw += `\n${line}`;
    }
  }
  return entries;
};

const cleaned = (raw: string) =>
  raw
    .replaceAll(/<ref[^>]*>.*?<\/ref>/gsu, "")
    .replaceAll(/\{\{\s*(?:صل|ص)\s*\}\}/gu, "ﷺ")
    .replaceAll(/\{\{[^{}]*\}\}/gu, "")
    .replaceAll(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/gu, "$1")
    .replaceAll(/'{2,}/gu, "")
    .replaceAll(/<[^>]+>/gu, "")
    .replaceAll(/\s+/gu, " ")
    .trim();

const gradeOf = (raw: string) =>
  [...raw.matchAll(/<ref[^>]*>(.*?)<\/ref>/gsu)]
    .map(([, grade = ""]) => grade.trim())
    .join(" ") || null;

const medianNumber = (entries: Entry[]) =>
  entries[Math.floor(entries.length / 2)]?.number ?? 0;

const numbered = (entries: (Entry & { chapter: number })[]) => {
  const used = new Set(entries.map((entry) => entry.number));
  const hadiths: Hadith[] = [];
  for (const [index, entry] of entries.entries()) {
    const previous = hadiths.at(-1);
    const next = entries[index + 1];
    const hadith = {
      number: entry.number,
      chapter: entry.chapter,
      url: entry.url,
      text: cleaned(entry.raw),
      grade: gradeOf(entry.raw),
    };
    if (previous === undefined || hadith.number > previous.number) {
      hadiths.push(hadith);
    } else if (
      !used.has(previous.number + 1) &&
      next?.number === previous.number + 2
    ) {
      used.add(previous.number + 1);
      hadiths.push({ ...hadith, number: previous.number + 1 });
    } else if (hadith.number !== previous.number) {
      throw new Error(
        `Hadith ${hadith.number} at ${hadith.url} comes after ${previous.number}`,
      );
    } else if (hadith.text !== previous.text) {
      previous.text += `\n${hadith.text}`;
    }
  }
  return hadiths;
};

export const wikisourceBook = async (book: string) => {
  const pages = await wikitexts(await subpages(book));
  const ordered = pages
    .map((page) => entriesOf(page))
    .filter((entries) => entries.length > 0)
    .toSorted((a, b) => medianNumber(a) - medianNumber(b));
  return JSON.stringify({
    fetchedAt: new Date().toISOString().slice(0, 10),
    hadiths: numbered(
      ordered.flatMap((entries, chapter) =>
        entries.map((entry) => ({ ...entry, chapter: chapter + 1 })),
      ),
    ),
  });
};
