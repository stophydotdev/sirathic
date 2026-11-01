import malikUrns from "./malikUrns.json";
import sunnahLettered from "./sunnahLettered.json";
import sunnahUrns from "./sunnahUrns.json";

const MALIK_URNS = new Map(Object.entries(malikUrns));

const SUNNAH_URNS = new Map(Object.entries(sunnahUrns));

const URN_IDS = new Map([
  ...[...SUNNAH_URNS].map(([id, urn]) => [urn, id] as const),
  ...[...MALIK_URNS].map(([number, urn]) => [String(urn), `malik:${number}`] as const),
]);

export const SUNNAH_LETTERED = new Map(Object.entries(sunnahLettered));

export const OUR_LETTERED = new Map(
  [...SUNNAH_LETTERED].map(([id, number]) => [`${id.slice(0, id.indexOf(":"))}:${number}`, id]),
);

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
  const lettered = SUNNAH_LETTERED.get(id);
  const collection = SUNNAH_COM_BOOKS.get(book);
  const page = /^(\d+[a-z]?)(?:\.\d+)?$/u.exec(lettered ?? citation)?.[1];
  return collection === undefined || page === undefined
    ? null
    : `https://sunnah.com/${collection}:${page}`;
};

export const hadithIdOfSunnahUrl = (url: string) => {
  const path = URL.parse(url)?.pathname ?? "";
  const moved = URN_IDS.get(/^\/urn\/(\d+)$/u.exec(path)?.[1] ?? "");
  if (moved !== undefined) return moved;
  const found = /^\/([a-z0-9]+):(\d+[a-z]?)$/u.exec(path);
  const book = [...SUNNAH_COM_BOOKS].find(([, collection]) => collection === found?.[1])?.[0];
  if (book === undefined || found?.[2] === undefined) return null;
  return OUR_LETTERED.get(`${book}:${found[2]}`) ?? `${book}:${found[2]}`;
};

const SHARED_PAGE_BOOKS = new Set(["ahmad", "adab"]);

export const hadithLink = (id: string, stored: string | null) => {
  const [book = "", number = ""] = id.split(":");
  const moved = SUNNAH_URNS.get(id);
  if (moved !== undefined) return `https://sunnah.com/urn/${moved}`;
  if (stored !== null) {
    return SHARED_PAGE_BOOKS.has(book) ? `${stored}#${number}` : stored;
  }
  const urn = book === "malik" ? MALIK_URNS.get(number) : undefined;
  if (urn !== undefined) return `https://sunnah.com/urn/${urn}`;
  return sunnahComLink(id);
};
