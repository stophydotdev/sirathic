import type { quranSurahFile, translationSurahFile } from "../../apps/data/src/schema";
import type { z } from "zod";
import type { Output } from "./output";
import { mapLimit } from "./util";
import { loadTanzil } from "./tanzil";
import { loadTranslations } from "./quranTranslations";

type SurahFile = z.infer<typeof quranSurahFile>;
type TranslationFile = z.infer<typeof translationSurahFile>;

const groupings = [
  { name: "juz", pick: (verse: SurahFile["data"]["verses"][number]) => verse.juz },
  { name: "page", pick: (verse: SurahFile["data"]["verses"][number]) => verse.page },
  { name: "hizb", pick: (verse: SurahFile["data"]["verses"][number]) => verse.hizb },
] as const;

export const buildQuran = async (rawDir: string, output: Output) => {
  const tanzil = await loadTanzil(rawDir);
  const sources = [tanzil.source];
  const ayahCounts = tanzil.surahs.map((surah) => surah.ayas);
  const surahFiles = tanzil.surahs.map((surah): SurahFile => ({
    data: {
      number: surah.index,
      name: surah.name,
      transliteration: surah.tname,
      englishName: surah.ename,
      revelation: surah.type,
      ayahs: surah.ayas,
      verses: tanzil.verses.filter((verse) => verse.surah === surah.index),
    },
    sources,
  }));
  await output.json("quran/surahs.json", {
    data: tanzil.surahs.map((surah) => {
      const first = tanzil.verses.find((verse) => verse.surah === surah.index);
      return {
        number: surah.index,
        name: surah.name,
        transliteration: surah.tname,
        englishName: surah.ename,
        revelation: surah.type,
        revelationOrder: surah.order,
        ayahs: surah.ayas,
        rukus: surah.rukus,
        startsOnPage: first?.page ?? 0,
        startsInJuz: first?.juz ?? 0,
      };
    }),
    sources,
  });
  await Promise.all(
    surahFiles.map((file) => output.json(`quran/surahs/${file.data.number}.json`, file)),
  );
  await Promise.all(
    groupings.flatMap(({ name, pick }) =>
      [...new Set(tanzil.verses.map(pick))].map((number) =>
        output.json(`quran/${name}/${number}.json`, {
          data: {
            kind: name,
            number,
            verses: tanzil.verses.filter((verse) => pick(verse) === number),
          },
          sources,
        }),
      ),
    ),
  );
  const loaded = await loadTranslations(rawDir, ayahCounts);
  const translationFiles = await mapLimit(
    [...loaded.rows.entries()],
    16,
    async ([name, verses]): Promise<TranslationFile> => {
      const [key = "", surah = "0"] = name.split("/");
      const translation = loaded.translations.find((entry) => entry.key === key);
      if (!translation) throw new Error(`unknown translation ${key}`);
      const file: TranslationFile = {
        data: {
          key,
          language: translation.language,
          title: translation.title,
          version: translation.version,
          surah: Number(surah),
          verses,
        },
        sources: [translation.source],
      };
      await output.json(`quran/translations/${key}/${surah}.json`, file);
      return file;
    },
  );
  await output.json("quran/translations.json", {
    data: loaded.translations.map((translation) => ({
      key: translation.key,
      language: translation.language,
      direction: translation.direction,
      title: translation.title,
      description: translation.description,
      version: translation.version,
      lastUpdate: translation.lastUpdate,
      missingAyahs: translation.missingAyahs,
    })),
    sources: loaded.translations.map((translation) => translation.source),
  });
  return {
    surahFiles,
    translationFiles,
    translations: loaded.translations,
    tanzil,
  };
};
