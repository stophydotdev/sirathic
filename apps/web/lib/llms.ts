import { SITE } from "@/lib/seo";

export const LLMS_INTRO = `# Sirathic

> Free Islamic answering engine. Answers come from the Quran, graded hadith and scholars' rulings, and cite their sources.

Sirathic is in 31 languages. Its Quran reader shows the Arabic with translations in English, French, Spanish, Turkish, Indonesian, Hindi, Bengali, German and Urdu, and tafsir. Its hadith library has the major collections in Arabic and English.

## Link to a source

- Surah: ${SITE}/{lang}/quran/{surah}, e.g. ${SITE}/en/quran/2
- Verse: ${SITE}/{lang}/quran/{surah}?ayah={ayah}, e.g. ${SITE}/en/quran/2?ayah=255
- Hadith book: ${SITE}/{lang}/hadith/{collection}/{book}, e.g. ${SITE}/en/hadith/bukhari/1
`;

export const textResponse = (text: string) =>
  new Response(text, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
