import malikUrns from "./malikUrns.json";

const MALIK_URNS = new Map(Object.entries(malikUrns));

const SUNNAH_COM_BOOKS = new Map([
  ["bukhari", "bukhari"],
  ["muslim", "muslim"],
  ["abudawud", "abudawud"],
  ["tirmidhi", "tirmidhi"],
  ["nasai", "nasai"],
  ["ibnmajah", "ibnmajah"],
  ["nawawi", "nawawi40"],
  ["qudsi", "qudsi40"],
  ["riyadussalihin", "riyadussalihin"],
]);

const sunnahComLink = (id: string) => {
  const [book = "", citation = ""] = id.split(":");
  const collection = SUNNAH_COM_BOOKS.get(book);
  const page = /^(\d+[a-z]?)(?:\.\d+)?$/u.exec(citation)?.[1];
  return collection === undefined || page === undefined
    ? null
    : `https://sunnah.com/${collection}:${page}`;
};

const HADITH_API =
  "https://github.com/fawazahmed0/hadith-api/blob/df57907be35291c91ad6a6691180e22ca9920784/editions";

const HADITH_API_EDITIONS = new Map([["dehlawi", "ara-dehlawi"]]);

const SHARED_PAGE_BOOKS = new Set(["ahmad", "adab"]);

export const hadithLink = (id: string, stored: string | null) => {
  const [book = "", number = ""] = id.split(":");
  if (stored !== null) {
    return SHARED_PAGE_BOOKS.has(book) ? `${stored}#${number}` : stored;
  }
  const urn = book === "malik" ? MALIK_URNS.get(number) : undefined;
  if (urn !== undefined) return `https://sunnah.com/urn/${urn}`;
  const edition = HADITH_API_EDITIONS.get(book);
  return edition !== undefined && /^\d+$/u.test(number)
    ? `${HADITH_API}/${edition}/${number}.json`
    : sunnahComLink(id);
};
