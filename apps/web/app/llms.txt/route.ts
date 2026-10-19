import { LLMS_INTRO, textResponse } from "@/lib/llms";
import { SITE } from "@/lib/seo";

export const GET = () =>
  textResponse(`${LLMS_INTRO}
## Read

- [Quran](${SITE}/en/quran): all 114 surahs in Arabic, with translations and tafsir
- [Hadith](${SITE}/en/hadith): Bukhari, Muslim and the other major collections, in Arabic and English
- [Full guide](${SITE}/llms-full.txt): every surah and hadith collection, with links

## Optional

- [Desktop app](${SITE}/en/download): Sirathic for Mac, Windows and Linux
`);
