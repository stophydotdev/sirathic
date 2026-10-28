import { expect, test } from "bun:test";
import { nearBest, nearFused, withinChars } from "../apps/server/src/chat/cut";
import { fuse } from "../apps/server/src/chat/fuse";
import { needsSources, relevant } from "../apps/server/src/chat/relevance";
import { onePerPage } from "../apps/server/src/chat/search";
import { cleanSearch } from "../apps/server/src/chat/searchQuery";
import { publicUrl } from "@sirathic/core/web/url";
import { withoutStopwords } from "@sirathic/core/search/arabic";
import { onePerAnswer } from "@sirathic/core/search/onePerAnswer";
import { SEARCHABLE } from "@sirathic/core/search/searchable";
import { hadithLink } from "@sirathic/core/tools/hadithLinks";
import { clean } from "../scripts/fatwaPages";
import { SITES } from "../scripts/fatwaSites";

test("keyword queries drop Arabic stopwords and keep every other word as written", () => {
  expect(withoutStopwords("حكم تعجيل الزكاة قبل الحول في المال")).toBe(
    "حكم تعجيل الزكاة قبل الحول المال",
  );
  expect(withoutStopwords("صلاة المسافر على الراحلة")).toBe("صلاة المسافر الراحلة");
  expect(withoutStopwords("Can I pray Fajr after sunrise?")).toBe("Can I pray Fajr after sunrise?");
});

test("a page and every translation of an islamqa.info answer count once, best rank first", () => {
  const ranked = [
    {
      id: "islamqa.info:fr:13729",
      url: "https://islamqa.info/fr/answers/13729",
    },
    { id: "islamqa.info:13729", url: "https://islamqa.info/en/answers/13729" },
    {
      id: "islamqa.org:8380",
      url: "https://islamqa.org/hanafi/daruliftaa/8380/",
    },
    {
      id: "islamqa.org:8380#2",
      url: "https://islamqa.org/hanafi/daruliftaa/8380/",
    },
    {
      id: "islamqa.info:ar:13729#2",
      url: "https://islamqa.info/ar/answers/13729",
    },
    {
      id: "islamqa.info:426916",
      url: "https://islamqa.info/en/answers/426916",
    },
  ];
  expect(onePerAnswer(ranked).map((row) => row.id)).toEqual([
    "islamqa.info:fr:13729",
    "islamqa.org:8380",
    "islamqa.info:426916",
  ]);
});

test("hadiths that share a chapter page get their own link", () => {
  const page = "https://ar.wikisource.org/wiki/chapter";
  expect(hadithLink("ahmad:781", page)).toBe(`${page}#781`);
  expect(hadithLink("ahmad:782", page)).not.toBe(hadithLink("ahmad:781", page));
});

test("Muwatta Malik links to the hadith's own page on sunnah.com", () => {
  expect(hadithLink("malik:1074", null)).toBe("https://sunnah.com/urn/510770");
});

test("the six books keep their sunnah.com links", () => {
  expect(hadithLink("muslim:1907a", null)).toBe("https://sunnah.com/muslim:1907a");
});

test("an extra chain numbered like 402.2 links to its hadith's page", () => {
  expect(hadithLink("bukhari:402.2", null)).toBe("https://sunnah.com/bukhari:402");
});

test("Riyad as-Salihin links to sunnah.com in its standard numbering", () => {
  expect(hadithLink("riyadussalihin:1", null)).toBe("https://sunnah.com/riyadussalihin:1");
});

test("site: moves into sites, quotes and uppercase operators go, Arabic stays as written", () => {
  expect(
    cleanSearch({
      queries: ['"zakat on jewelry" site:islamqa.info', "zakat OR sadaqah  NOT  gold or silver"],
      arabic: ["«زكاة الحلي» AND الذهب"],
      sites: ["https://www.Islamweb.net/ar/"],
    }),
  ).toEqual({
    queries: ["zakat on jewelry", "zakat sadaqah gold or silver"],
    arabic: ["زكاة الحلي الذهب"],
    sites: ["islamweb.net", "islamqa.info"],
    notes: [],
  });
});

test("an Arabic query written in both fields stays in queries, so Quran and the web still search it", () => {
  expect(cleanSearch({ queries: ["حكم البيتكوين"], arabic: ["حكم البيتكوين"], sites: [] })).toEqual(
    { queries: ["حكم البيتكوين"], arabic: ["حكم البيتكوين"], sites: [], notes: [] },
  );
});

test("a query left empty is skipped and a site that is not a domain is reported", () => {
  expect(cleanSearch({ queries: ['"" AND', "wudu"], arabic: [], sites: ["islamqa"] })).toEqual({
    queries: ["wudu"],
    arabic: [],
    sites: [],
    notes: [
      "A query was empty after removing quotes and operators, so it was skipped.",
      '"islamqa" is not a domain, so it was ignored. Use one like islamqa.info.',
    ],
  });
});

const readable = (url: string) => publicUrl.safeParse(url).success;

test("only public http and https pages can be read", () => {
  expect(readable("https://islamqa.info/en/answers/1")).toBe(true);
  expect(
    [
      "file:///etc/passwd",
      "ftp://islamqa.info/a",
      "http://localhost:3000/",
      "http://127.0.0.1/",
      "http://2130706433/",
      "http://10.0.0.5/admin",
      "http://169.254.169.254/latest/meta-data/",
      "http://192.168.1.1/",
      "http://[::1]/",
      "http://metadata.google.internal/",
      "http://intranet/",
    ].map(readable),
  ).toEqual(Array(11).fill(false));
});

test("passages Jev scores below the floor are dropped in our order, and a failed check keeps them all", async () => {
  const original = globalThis.fetch;
  const answers = { p1: { noul: 0.9 }, p2: { noul: 0.05 }, p3: { noul: 0.4 } };
  globalThis.fetch = Object.assign(async () => Response.json({ answers }), {
    preconnect: () => {},
  });
  const search = `wudu ${crypto.randomUUID()}`;
  const scored = await relevant(search, ["a", "b", "c"], (item) => item);
  globalThis.fetch = Object.assign(async () => new Response("busy", { status: 429 }), {
    preconnect: () => {},
  });
  const failed = await relevant(`${search} again`, ["a", "b", "c"], (item) => item);
  globalThis.fetch = original;
  expect([scored, failed]).toEqual([
    { kept: ["a", "c"], dropped: ["b"] },
    { kept: ["a", "b", "c"], dropped: [] },
  ]);
});

test("a short first message skips the forced search only when Jev says it needs no sources", async () => {
  const original = globalThis.fetch;
  const asked: string[] = [];
  const answering = (noul: number) =>
    Object.assign(
      async (_url: string | URL | Request, init?: RequestInit) => {
        asked.push(String(init?.body));
        return Response.json({ answers: { sources: { noul } } });
      },
      { preconnect: () => {} },
    );
  globalThis.fetch = answering(0.02);
  const greeting = await needsSources("Salam, who made you?");
  globalThis.fetch = answering(0.4);
  const question = await needsSources("riba?");
  const long = await needsSources("x".repeat(51));
  globalThis.fetch = Object.assign(async () => new Response("busy", { status: 503 }), {
    preconnect: () => {},
  });
  const failed = await needsSources("wudu?");
  globalThis.fetch = original;
  expect([greeting, question, long, failed, asked.length]).toEqual([false, true, true, true, 2]);
});

test("fiqh chunks from the same page become one passage, in the order found", () => {
  const chunk = {
    workId: "w1",
    school: "hanafi" as const,
    work: "Kitab",
    author: "Author",
    deathYearAh: 600,
    volume: 1,
    heading: null,
    distance: 0,
  };
  const merged = onePerPage([
    { ...chunk, id: "a", page: 5, url: "https://shamela.ws/book/1#1:5", textAr: "أول" },
    { ...chunk, id: "b", page: 6, url: "https://shamela.ws/book/1#1:6", textAr: "آخر" },
    { ...chunk, id: "c", page: 5, url: "https://shamela.ws/book/1#1:5", textAr: "ثان" },
  ]);
  expect(merged.map(({ id, textAr }) => [id, textAr])).toEqual([
    ["a", "أول\nثان"],
    ["b", "آخر"],
  ]);
});

test("every searchable table's vector column is as wide as its embedder's vectors", () => {
  const mismatched = Object.entries(SEARCHABLE).flatMap(([name, { embedding, embedder }]) =>
    embedding.getSQLType() === `halfvec(${embedder.dimensions})` ? [] : [name],
  );
  expect(mismatched).toEqual([]);
});

test("a result two queries both found beats one only a single query ranked first", () => {
  expect(
    fuse(
      [
        ["a", "b"],
        ["c", "b"],
      ],
      (id) => id,
    ),
  ).toEqual(["b", "a", "c"]);
});

test("results far behind the best one are cut, but a school's own best stays", () => {
  const items = [
    { id: "a", distance: 0.3 },
    { id: "b", distance: 0.34 },
    { id: "c", distance: 0.5 },
    { id: "d", distance: 0.9 },
  ];
  expect(nearBest(items, (item) => item.id === "d").map(({ id }) => id)).toEqual(["a", "b", "d"]);
});

test("results stop at the character budget, and the first one always fits", () => {
  const { fits, over } = withinChars(["aaaa", "bb", "cc"], (text) => text.length, 3);
  expect({ fits, over }).toEqual({ fits: ["aaaa"], over: ["bb", "cc"] });
});

test("a result far behind one query's best gets no votes from that query", () => {
  const { near, far } = nearFused(
    [
      [
        { id: "s1", distance: 0.3 },
        { id: "s2", distance: 0.31 },
      ],
      [
        { id: "b", distance: 0.3 },
        { id: "s1", distance: 0.9 },
        { id: "s2", distance: 0.9 },
        { id: "x", distance: 0.95 },
      ],
    ],
    (item) => item.id,
  );
  expect([near.map(({ id }) => id), far.map(({ id }) => id)]).toEqual([["s1", "b", "s2"], ["x"]]);
});

const parsedBy = (name: string, markdown: string, html: string, url: string) =>
  SITES.find((site) => site.source.name === name)?.parse(markdown, html, url);

test("a short fatwa with a question and an answer is kept, a short page without one is not", () => {
  const url = "https://al-fatawa.com/en/fatwa/22868/one-who-trusted-prayer-valid";
  const dialogue = parsedBy(
    "al-fatawa.com",
    "# Is his prayer valid?\n\nThe questioner : Is the prayer of the one who is trusted valid?\n\nThe Shaykh : Yes, exactly.",
    "",
    url,
  );
  const unmarked = parsedBy("al-fatawa.com", "# A video\n\nWatch it on Vimeo.", "", url);
  expect([dialogue?.question, dialogue?.answer, unmarked]).toEqual([
    "The questioner : Is the prayer of the one who is trusted valid?",
    "Yes, exactly.",
    undefined,
  ]);
});

test("an islamqa.org answer without a # line takes its title from the page", () => {
  const fatwa = parsedBy(
    "islamqa.org",
    "From\n\nAnswered by\n\nShaykh Ebrahim Salejee\n\n**Q:** Is share trading permissible?\n\n**A:** It is, if the company deals in halal.\n\n**Original Source Link**",
    "<title>Share Trading: Halal or Haram? - IslamQA</title>",
    "https://islamqa.org/hanafi/muftionline/45693/share-trading-halal-or-haram/",
  );
  expect([fatwa?.title, fatwa?.answeredBy]).toEqual([
    "Share Trading: Halal or Haram?",
    "Shaykh Ebrahim Salejee",
  ]);
});

test("a saved fatwa keeps its text and drops the page around it", () => {
  const alFatawa = clean(
    "Machine translationRead the Arabic original\n\nThe Shaykh : It has no basis.\n\nSource alathar.net\n\nThe Arabic text is copied verbatim from the original source, without any edits.\n\n## Similar fatwas\n\n- Another fatwa",
  );
  const darAlifta = parsedBy(
    "dar-alifta.org",
    `# حكم الوفاء بالنذر\n\n${"يجب الوفاء بالنذر إذا كان في طاعة. ".repeat(14)}\n\nوالله سبحانه وتعالى أعلم.\n\nاقرأ أيضا :\n\nما حكم الحج عن كبير السن؟\n\nالفجر\n5 :31`,
    "",
    "https://www.dar-alifta.org/ar/fatwa/details/12911/nazr",
  )?.answer;
  const amja = clean("- AR (العربية)\n\\-- EN (English)\n\n| **رقم الفتوى:** | 3882 |");
  expect([alFatawa, darAlifta?.endsWith("والله سبحانه وتعالى أعلم."), amja]).toEqual([
    "The Shaykh : It has no basis.",
    true,
    "| **رقم الفتوى:** | 3882 |",
  ]);
});
