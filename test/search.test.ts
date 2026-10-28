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
  const scored = await relevant("wudu", ["a", "b", "c"], (item) => item);
  globalThis.fetch = Object.assign(async () => new Response("busy", { status: 429 }), {
    preconnect: () => {},
  });
  const failed = await relevant("wudu", ["a", "b", "c"], (item) => item);
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
