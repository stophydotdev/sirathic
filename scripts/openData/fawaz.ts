import { z } from "zod";
import type { CollectionSlug } from "../../apps/data/src/resolve";
import { download, fawazSource, fetchJson } from "./sources";
import { letterNumber } from "./verify";

const commitInfo = z.object({
  sha: z.string(),
  commit: z.object({ committer: z.object({ date: z.string() }) }),
});

const edition = z.object({
  metadata: z.object({ name: z.string() }),
  hadiths: z.array(
    z.object({
      hadithnumber: z.number(),
      arabicnumber: z.union([z.number(), z.string()]).optional(),
      text: z.string(),
      grades: z.array(z.object({ name: z.string(), grade: z.string() })),
      reference: z.object({ book: z.number(), hadith: z.number() }),
    }),
  ),
});

const partNumber = (value: number | string) => {
  const [base = "0", part] = String(value).split(".");
  return part === undefined ? String(Number(base)) : letterNumber(Number(base), Number(part));
};

export const loadFawaz = async (rawDir: string, slugs: readonly CollectionSlug[]) => {
  const commit = await fetchJson(
    "https://api.github.com/repos/fawazahmed0/hadith-api/commits/1",
    commitInfo,
  );
  const collections = await Promise.all(
    slugs.map(async (slug) => {
      const path = await download(
        `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@${commit.sha}/editions/ara-${slug}.json`,
        `${rawDir}/fawaz-${commit.sha.slice(0, 7)}/ara-${slug}.json`,
      );
      const file = edition.parse(await Bun.file(path).json());
      const hadith = file.hadiths.map((entry) => {
        const publicNumber = slug === "muslim" ? entry.arabicnumber : entry.hadithnumber;
        return {
          number:
            publicNumber === undefined ? `fawaz-${entry.hadithnumber}` : partNumber(publicNumber),
          inBook: entry.reference,
          arabic: entry.text,
          grades: entry.grades,
        };
      });
      return { slug, name: file.metadata.name, hadith };
    }),
  );
  return {
    collections,
    source: fawazSource(commit.sha, commit.commit.committer.date.slice(0, 10)),
  };
};
