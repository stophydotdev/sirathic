import { parseArgs } from "node:util";
import { collectionSlugs } from "../apps/data/src/resolve";
import { buildCatalog } from "./openData/catalog";
import { buildCurated } from "./openData/curated";
import { buildDownloads } from "./openData/bundles";
import { buildHadith } from "./openData/hadith";
import { createOutput } from "./openData/output";
import { publishLocal, publishRemote } from "./openData/publish";
import { buildQuran } from "./openData/quran";

const { values } = parseArgs({
  options: {
    out: { type: "string", default: "data/openData" },
    raw: { type: "string", default: "data/openDataRaw" },
    sunnah: { type: "string" },
    publish: { type: "string" },
    "skip-build": { type: "boolean", default: false },
  },
});

const output = createOutput(values.out);

if (!values["skip-build"]) {
  if (!values.sunnah) throw new Error("pass --sunnah <folder of cached sunnah.com pages>");
  const cachedOn = /\d{4}-\d{2}-\d{2}/.exec(values.sunnah)?.[0] ?? "unknown";
  const quran = await buildQuran(values.raw, output);
  const hadith = await buildHadith(values.raw, values.sunnah, cachedOn, output);
  const curated = await buildCurated(values.raw, output);
  const sources = [
    quran.tanzil.source,
    ...quran.translations.map((t) => t.source),
    ...hadith.sources,
    curated.source,
  ];
  await buildCatalog(output, sources, quran.tanzil.notices);
  const downloads = await buildDownloads(output, quran, hadith, curated);
  console.table(
    hadith.summary.map(({ slug, total, verified, unverified, secondCopyOnly }) =>
      Object.assign({ slug, total, verified }, unverified, { secondCopyOnly }),
    ),
  );
  console.log(
    `quran: ${quran.surahFiles.length} surahs, ${quran.tanzil.verses.length} verses, ${quran.translations.length} translations (${quran.translations.filter((t) => t.missingAyahs > 0).length} with missing ayahs)`,
  );
  console.log(
    `curated: ${curated.files.length} hadith, ${curated.languages.length} languages, ${curated.outdated} translations older than the Arabic`,
  );
  console.log(`downloads: ${downloads.length} files, collections: ${collectionSlugs.length}`);
}

if (values.publish === "local") {
  console.log(
    `loaded ${await publishLocal(values.out, "apps/data/wrangler.jsonc", "apps/data/.wrangler/state/v3")} files into the local bucket`,
  );
}
if (values.publish === "remote") {
  console.log(`uploaded ${await publishRemote(values.out)} files to R2`);
}
