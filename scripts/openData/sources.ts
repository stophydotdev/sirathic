import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { z } from "zod";
import type { Source } from "../../apps/data/src/schema";

export const builtAt = new Date().toISOString().slice(0, 10);

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

const fetchBytes = async (url: string, attempt = 1): Promise<Uint8Array> => {
  const response = await fetch(url, { headers: { "user-agent": "sirathic-open-data/1" } }).catch(
    () => null,
  );
  if (response?.ok) return new Uint8Array(await response.arrayBuffer());
  if (attempt >= 4) throw new Error(`download failed: ${url} ${response?.status ?? "no response"}`);
  await wait(1000 * attempt);
  return fetchBytes(url, attempt + 1);
};

export const download = async (url: string, path: string) => {
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    await Bun.write(path, await fetchBytes(url));
  }
  return path;
};

export const fetchJson = async <Schema extends z.ZodType>(url: string, schema: Schema) =>
  schema.parse(JSON.parse(new TextDecoder().decode(await fetchBytes(url))));

const tanzilNotice = (version: string, year: string) =>
  `Tanzil Quran Text (Uthmani and Simple Clean, Version ${version}). Copyright (C) 2007-${year} Tanzil Project. License: Creative Commons Attribution 3.0. Permission is granted to copy and distribute verbatim copies of this text, but changing it is not allowed. Source: Tanzil Project, https://tanzil.net. Check updates at http://tanzil.net/updates/.`;

export const tanzilSource = (version: string, year: string) =>
  ({
    id: "tanzil",
    name: "Tanzil Project",
    url: "https://tanzil.net",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    version,
    attribution: tanzilNotice(version, year),
  }) satisfies Source;

export const quranEncSource = (translation: { key: string; title: string; version: string }) =>
  ({
    id: `quranenc:${translation.key}`,
    name: `QuranEnc.com: ${translation.title}`,
    url: `https://quranenc.com/en/browse/${translation.key}`,
    license: "Free to republish with no modification, addition or deletion, crediting QuranEnc.com",
    licenseUrl: "https://quranenc.com",
    version: translation.version,
    attribution: `${translation.title}, version ${translation.version}. Published by QuranEnc.com (https://quranenc.com), the publisher and source. Republished without modification, addition or deletion.`,
  }) satisfies Source;

export const hadeethEncSource = (version: string) =>
  ({
    id: "hadeethenc",
    name: "HadeethEnc.com",
    url: "https://hadeethenc.com",
    license:
      "Free to republish with no modification, addition or deletion, crediting HadeethEnc.com",
    licenseUrl: "https://hadeethenc.com",
    version,
    attribution: `Hadith encyclopedia content published by HadeethEnc.com (https://hadeethenc.com), the publisher and source, latest download dated ${version}, each language carries its own released date. Republished without modification, addition or deletion.`,
  }) satisfies Source;

export const fawazSource = (commit: string, date: string) =>
  ({
    id: "fawazahmed0-hadith-api",
    name: "fawazahmed0 hadith-api",
    url: "https://github.com/fawazahmed0/hadith-api",
    license: "Unlicense (public domain)",
    licenseUrl: "https://unlicense.org",
    version: `${commit.slice(0, 7)} (${date})`,
    attribution: `Arabic hadith text, grades and references from fawazahmed0/hadith-api (https://github.com/fawazahmed0/hadith-api), commit ${commit.slice(0, 7)}, released under the Unlicense.`,
  }) satisfies Source;

export const sunnahSource = (cachedOn: string) =>
  ({
    id: "sunnah-references",
    name: "sunnah.com reference numbers (cross-check only)",
    url: "https://sunnah.com",
    license: "Reference numbers are facts. Nothing from it is republished",
    licenseUrl: "https://sunnah.com",
    version: cachedOn,
    attribution: `Hadith numbers and Arabic were checked against pages from sunnah.com (cached ${cachedOn}). The check ran in memory: none of its text or translations is published, only reference numbers are used.`,
  }) satisfies Source;
