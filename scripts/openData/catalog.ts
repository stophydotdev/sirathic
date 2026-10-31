import type { Source } from "../../apps/data/src/schema";
import type { Output } from "./output";
import { builtAt } from "./sources";

const endpoints = [
  ["/v1", "this index"],
  ["/v1/sources", "every source with its license, version and required attribution"],
  ["/v1/downloads", "full datasets as SQLite and JSON with size, sha256 and license"],
  ["/v1/downloads/{name}", "one dataset file from /v1/downloads"],
  ["/v1/quran/surahs", "the 114 surahs"],
  ["/v1/quran/surahs/{surah}", "one surah with every verse in Uthmani and simple script"],
  ["/v1/quran/verses/{surah}:{ayah}", "one verse, add ?translations=key1,key2 for translations"],
  ["/v1/quran/verses?juz={1-30}", "every verse of a juz, or use ?page={1-604} or ?hizb={1-60}"],
  ["/v1/quran/translations", "every translation with its language and version"],
  ["/v1/quran/translations/{key}/{surah}", "one surah in one translation"],
  ["/v1/hadith/collections", "collections with counts of verified and unverified hadith"],
  ["/v1/hadith/{collection}/{number}", "one hadith with grades and its verified flag"],
  [
    "/v1/hadith/resolve?ref={reference}",
    'a verified hadith from any reference, like "muslim 2291a" or "bukhari, book 1, hadith 1"',
  ],
  [
    "/v1/hadith/curated/{id}?lang={code}",
    "a graded, explained hadith from HadeethEnc, in one or more languages",
  ],
  ["/v1/hadith/curated/categories", "the HadeethEnc categories in every language"],
  ["/v1/hadith/unverified", "every hadith that could not be verified, with the reason"],
] as const;

export const buildCatalog = async (output: Output, sources: Source[], notices: string[]) => {
  const note = `Free and open, no API key. Every response lists its sources with the license, version and attribution each source requires. Quran word-by-word morphology is not included yet.`;
  await output.json("index.json", {
    data: {
      name: "Sirathic open data",
      version: "1",
      builtAt,
      note,
      endpoints: endpoints.map(([path, description]) => ({ path, description })),
    },
    sources,
  });
  await output.json("sources.json", {
    data: sources.map((source) => ({
      ...source,
      notice: source.id === "tanzil" ? notices.join("\n\n") : null,
    })),
    sources,
  });
};
