import { LLMS_INTRO, textResponse } from "@/lib/llms";
import { loadCollections, loadQuranIndex } from "@/lib/server-api";
import { SITE } from "@/lib/seo";

export const GET = async () => {
  const [index, collections] = await Promise.all([
    loadQuranIndex(),
    loadCollections(),
  ]);
  const surahs = (index?.surahs ?? []).map(
    (surah) =>
      `- ${surah.number}. ${surah.nameTranslit} (${surah.nameEn}), ${surah.verseCount} ayahs: ${SITE}/en/quran/${surah.number}`,
  );
  const books = (collections ?? []).map(
    (collection) =>
      `- ${collection.nameEn}, ${collection.hadiths.toLocaleString("en")} hadith: ${SITE}/en/hadith/${collection.id}`,
  );
  return textResponse(`${LLMS_INTRO}
## Surahs

${surahs.join("\n")}

## Hadith collections

${books.join("\n")}
`);
};
