import { expect, test } from "bun:test";
import { relevant } from "../apps/server/src/chat/relevance";
import { cleanSearch } from "../apps/server/src/chat/searchQuery";
import { publicUrl } from "@sirathic/core/web/url";
import { withoutStopwords } from "@sirathic/core/search/arabic";
import { onePerAnswer } from "@sirathic/core/search/onePerAnswer";
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

test("an Arabic query written in both fields is searched once, as Arabic", () => {
  expect(
    cleanSearch({
      queries: ["bitcoin ruling", "حكم البيتكوين"],
      arabic: ["حكم البيتكوين"],
      sites: [],
    }),
  ).toEqual({ queries: ["bitcoin ruling"], arabic: ["حكم البيتكوين"], sites: [], notes: [] });
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
