export const DATA_DIR = `${import.meta.dirname}/../data`;
export const QUL_DIR = `${DATA_DIR}/qul`;
export const QUL_WORDS = "quran-script/56-uthmani/uthmani.json.zip";
export const QUL_TRANSLITERATION = 71;
export const QUL_VERSE_TRANSLITERATION = 469;
export const TRANSLATION_LANGUAGES = [
  ["English", "en"],
  ["Urdu", "ur"],
  ["Hindi", "hi"],
  ["French", "fr"],
  ["Spanish", "es"],
  ["German", "de"],
  ["Indonesian", "id"],
  ["Turkish", "tr"],
  ["Bengali", "bn"],
] as const;
export const DUPLICATE_TRANSLATIONS = [193, 301];
export const QUL_TAFSIRS = [
  {
    id: 22,
    name: "Tafsir Ibn Kathir",
    lang: "ar",
    author: "Ibn Kathir (d. 774 AH)",
  },
  {
    id: 37,
    name: "Tafsir al-Tabari",
    lang: "ar",
    author: "al-Tabari (d. 310 AH)",
  },
  {
    id: 23,
    name: "Tafsir al-Qurtubi",
    lang: "ar",
    author: "al-Qurtubi (d. 671 AH)",
  },
  {
    id: 27,
    name: "Tafsir al-Baghawi",
    lang: "ar",
    author: "al-Baghawi (d. 516 AH)",
  },
  {
    id: 523,
    name: "Tafsir al-Jalalayn",
    lang: "ar",
    author: "al-Mahalli and al-Suyuti (d. 911 AH)",
  },
  {
    id: 43,
    name: "Tazkirul Quran",
    lang: "ur",
    author: "Maulana Wahiduddin Khan, CPS International",
  },
] as const;
export const WORD_MEANINGS = [
  ["en", 92],
  ["ur", 93],
  ["hi", 44],
  ["bn", 94],
  ["id", 96],
  ["tr", 99],
  ["fa", 91],
  ["fr", 95],
  ["ta", 98],
  ["inh", 100],
] as const;
export const TIMED_RECITATIONS = [
  118, 115, 114, 112, 108, 116, 107, 113, 119, 103, 104,
] as const;
export const HADITH_COMMIT = "df57907be35291c91ad6a6691180e22ca9920784";

export const HADITHS_PER_BOOK = {
  bukhari: 7589,
  muslim: 7563,
  abudawud: 5274,
  tirmidhi: 3998,
  nasai: 5765,
  ibnmajah: 4343,
  malik: 1858,
  nawawi: 42,
  qudsi: 40,
  dehlawi: 40,
};

export const MOKHTASAR_LANGUAGES = [
  ["arabic", "ar"],
  ["english", "en"],
  ["french", "fr"],
  ["spanish", "es"],
  ["italian", "it"],
  ["russian", "ru"],
  ["turkish", "tr"],
  ["azeri", "az"],
  ["bosnian", "bs"],
  ["serbian", "sr"],
  ["uzbek", "uz"],
  ["kyrgyz", "ky"],
  ["indonesian", "id"],
  ["tagalog", "tl"],
  ["chinese", "zh"],
  ["uyghur", "ug"],
  ["japanese", "ja"],
  ["vietnamese", "vi"],
  ["thai", "th"],
  ["khmer", "km"],
  ["persian", "fa"],
  ["kurdish", "ku"],
  ["pashto", "ps"],
  ["hindi", "hi"],
  ["bengali", "bn"],
  ["telugu", "te"],
  ["malayalam", "ml"],
  ["assamese", "as"],
  ["tamil", "ta"],
  ["sinhalese", "si"],
  ["fulani", "ff"],
] as const;

const MOKHTASAR = "Al-Mukhtasar in Interpreting the Noble Quran";
const TAFSIR_CENTER = "Tafsir Center for Quranic Studies, QuranEnc.com";

export const mokhtasarCredit = (language: string) => {
  if (language === "english")
    return `The Abridged Explanation of the Quran, ${TAFSIR_CENTER}`;
  if (language === "arabic") return `${MOKHTASAR}, ${TAFSIR_CENTER}`;
  return `${language.charAt(0).toUpperCase()}${language.slice(1)} Translation of ${MOKHTASAR}, ${TAFSIR_CENTER}`;
};

export const WIKISOURCE_SOURCE = "wikisource-ar";

export const WIKISOURCE_BOOKS = {
  darimi: { title: "سنن الدارمي", hadiths: 3367 },
  adab: { title: "الأدب المفرد", hadiths: 1322 },
  riyadussalihin: { title: "رياض الصالحين", hadiths: 1689 },
  ahmad: { title: "مسند أحمد بن حنبل", hadiths: 26340 },
} as const;

export const FIQH_SOURCE = "islamlab-islamic-sciences-fiqh";
export const HADITH_ENGLISH_SOURCE = "sirathic-en";
export const FIQH_REVISION = "50a4f4280013018b9acbcc5024ebca2c60684dc5";
export const FIQH_DATASET = "islamlab/islamic-sciences";
export const FIQH_WORKS_FILE = "works/train-00000.parquet";
export const FIQH_PASSAGES_FILE = "passages/train-00900.parquet";

export const FIQH_WORKS = {
  "shamela.4404": { school: "hanafi", passages: 1872 },
  "shamela.5775": { school: "hanafi", passages: 21728 },
  "shamela.4226": { school: "maliki", passages: 386 },
  "shamela.5768": { school: "maliki", passages: 12913 },
  "shamela.566": { school: "maliki", passages: 8012 },
  "shamela.4288": { school: "shafii", passages: 11956 },
  "shamela.480": { school: "shafii", passages: 9483 },
  "shamela.2437": { school: "hanbali", passages: 13567 },
  "shamela.598": { school: "hanbali", passages: 6192 },
  "shamela.1456": { school: "hanbali", passages: 846 },
  "shamela.5841": { school: "comparative", passages: 2623 },
} as const;

export const FATWA_MIRRORS = {
  "seekersguidance-hanafi": "seekersguidance.org",
  "seekersguidance-shafii": "seekersguidance.org",
  "seekersguidance-maliki": "seekersguidance.org",
  mathabah: "mathabah.org",
  albalagh: "albalagh.net",
} as const;
