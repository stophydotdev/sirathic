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
  ["dehlawi", "shahwaliullah40"],
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

export const hadithIdOfSunnahUrl = (url: string) => {
  const found = /^\/([a-z0-9]+):(\d+[a-z]?)$/u.exec(URL.parse(url)?.pathname ?? "");
  const book = [...SUNNAH_COM_BOOKS].find(([, collection]) => collection === found?.[1])?.[0];
  return book === undefined || found?.[2] === undefined ? null : `${book}:${found[2]}`;
};

const SHARED_PAGE_BOOKS = new Set(["ahmad", "adab"]);

export const hadithLink = (id: string, stored: string | null) => {
  const [book = "", number = ""] = id.split(":");
  if (stored !== null) {
    return SHARED_PAGE_BOOKS.has(book) ? `${stored}#${number}` : stored;
  }
  const urn = book === "malik" ? MALIK_URNS.get(number) : undefined;
  if (urn !== undefined) return `https://sunnah.com/urn/${urn}`;
  return sunnahComLink(id);
};
