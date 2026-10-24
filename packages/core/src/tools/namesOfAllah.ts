import { z } from "zod";

const NAMES = [
  ["اللَّهُ", "Allah", "Allah, the proper name of God"],
  ["الرَّحْمَنُ", "Ar-Rahman", "The Entirely Merciful"],
  ["الرَّحِيمُ", "Ar-Rahim", "The Especially Merciful"],
  ["الْمَلِكُ", "Al-Malik", "The King"],
  ["الْقُدُّوسُ", "Al-Quddus", "The Most Holy"],
  ["السَّلاَمُ", "As-Salam", "The Source of Peace"],
  ["الْمُؤْمِنُ", "Al-Mu'min", "The Giver of Security"],
  ["الْمُهَيْمِنُ", "Al-Muhaymin", "The Guardian over all"],
  ["الْعَزِيزُ", "Al-Aziz", "The Almighty"],
  ["الْجَبَّارُ", "Al-Jabbar", "The Compeller"],
  ["الْمُتَكَبِّرُ", "Al-Mutakabbir", "The Supreme in Greatness"],
  ["الْخَالِقُ", "Al-Khaliq", "The Creator"],
  ["الْبَارِئُ", "Al-Bari", "The Maker"],
  ["الْمُصَوِّرُ", "Al-Musawwir", "The Fashioner of Forms"],
  ["الْغَفَّارُ", "Al-Ghaffar", "The Ever-Forgiving"],
  ["الْقَهَّارُ", "Al-Qahhar", "The Subduer"],
  ["الْوَهَّابُ", "Al-Wahhab", "The Bestower"],
  ["الرَّزَّاقُ", "Ar-Razzaq", "The Provider"],
  ["الْفَتَّاحُ", "Al-Fattah", "The Opener and Judge"],
  ["الْعَلِيمُ", "Al-Alim", "The All-Knowing"],
  ["الْقَابِضُ", "Al-Qabid", "The Withholder"],
  ["الْبَاسِطُ", "Al-Basit", "The Extender"],
  ["الْخَافِضُ", "Al-Khafid", "The Abaser"],
  ["الرَّافِعُ", "Ar-Rafi", "The Exalter"],
  ["الْمُعِزُّ", "Al-Mu'izz", "The Giver of Honour"],
  ["الْمُذِلُّ", "Al-Mudhill", "The Giver of Disgrace"],
  ["السَّمِيعُ", "As-Sami", "The All-Hearing"],
  ["الْبَصِيرُ", "Al-Basir", "The All-Seeing"],
  ["الْحَكَمُ", "Al-Hakam", "The Judge"],
  ["الْعَدْلُ", "Al-Adl", "The Just"],
  ["اللَّطِيفُ", "Al-Latif", "The Subtle and Kind"],
  ["الْخَبِيرُ", "Al-Khabir", "The All-Aware"],
  ["الْحَلِيمُ", "Al-Halim", "The Forbearing"],
  ["الْعَظِيمُ", "Al-Azim", "The Magnificent"],
  ["الْغَفُورُ", "Al-Ghafur", "The All-Forgiving"],
  ["الشَّكُورُ", "Ash-Shakur", "The Appreciative"],
  ["الْعَلِيُّ", "Al-Aliyy", "The Most High"],
  ["الْكَبِيرُ", "Al-Kabir", "The Most Great"],
  ["الْحَفِيظُ", "Al-Hafiz", "The Preserver"],
  ["الْمُقِيتُ", "Al-Muqit", "The Nourisher"],
  ["الْحَسِيبُ", "Al-Hasib", "The Reckoner and Sufficient"],
  ["الْجَلِيلُ", "Al-Jalil", "The Majestic"],
  ["الْكَرِيمُ", "Al-Karim", "The Generous"],
  ["الرَّقِيبُ", "Ar-Raqib", "The Watchful"],
  ["الْمُجِيبُ", "Al-Mujib", "The Responsive"],
  ["الْوَاسِعُ", "Al-Wasi", "The All-Encompassing"],
  ["الْحَكِيمُ", "Al-Hakim", "The All-Wise"],
  ["الْوَدُودُ", "Al-Wadud", "The Loving"],
  ["الْمَجِيدُ", "Al-Majeed", "The Glorious"],
  ["الْبَاعِثُ", "Al-Ba'ith", "The Resurrector"],
  ["الشَّهِيدُ", "Ash-Shahid", "The Witness"],
  ["الْحَقُّ", "Al-Haqq", "The Truth"],
  ["الْوَكِيلُ", "Al-Wakil", "The Trustee"],
  ["الْقَوِيُّ", "Al-Qawiyy", "The Strong"],
  ["الْمَتِينُ", "Al-Matin", "The Firm"],
  ["الْوَلِيُّ", "Al-Waliyy", "The Protecting Friend"],
  ["الْحَمِيدُ", "Al-Hamid", "The Praiseworthy"],
  ["الْمُحْصِي", "Al-Muhsi", "The One who counts all things"],
  ["الْمُبْدِئُ", "Al-Mubdi", "The Originator"],
  ["الْمُعِيدُ", "Al-Mu'id", "The Restorer"],
  ["الْمُحْيِي", "Al-Muhyi", "The Giver of Life"],
  ["الْمُمِيتُ", "Al-Mumit", "The Bringer of Death"],
  ["الْحَىُّ", "Al-Hayy", "The Ever-Living"],
  ["الْقَيُّومُ", "Al-Qayyum", "The Self-Sustaining"],
  ["الْوَاجِدُ", "Al-Wajid", "The One who lacks nothing"],
  ["الْمَاجِدُ", "Al-Maajid", "The Noble"],
  ["الْوَاحِدُ", "Al-Wahid", "The One"],
  ["الصَّمَدُ", "As-Samad", "The Eternal Refuge"],
  ["الْقَادِرُ", "Al-Qadir", "The Able"],
  ["الْمُقْتَدِرُ", "Al-Muqtadir", "The All-Powerful"],
  ["الْمُقَدِّمُ", "Al-Muqaddim", "The One who brings forward"],
  ["الْمُؤَخِّرُ", "Al-Mu'akhkhir", "The One who delays"],
  ["الأَوَّلُ", "Al-Awwal", "The First"],
  ["الآخِرُ", "Al-Akhir", "The Last"],
  ["الظَّاهِرُ", "Az-Zahir", "The Manifest"],
  ["الْبَاطِنُ", "Al-Batin", "The Hidden"],
  ["الْوَالِي", "Al-Wali", "The Governor"],
  ["الْمُتَعَالِي", "Al-Muta'ali", "The Most Exalted"],
  ["الْبَرُّ", "Al-Barr", "The Source of Goodness"],
  ["التَّوَّابُ", "At-Tawwab", "The Accepter of Repentance"],
  ["الْمُنْتَقِمُ", "Al-Muntaqim", "The Avenger"],
  ["الْعَفُوُّ", "Al-Afuww", "The Pardoner"],
  ["الرَّءُوفُ", "Ar-Ra'uf", "The Most Kind"],
  ["مَالِكُ الْمُلْكِ", "Malik al-Mulk", "Owner of All Sovereignty"],
  ["ذُو الْجَلاَلِ وَالإِكْرَامِ", "Dhul-Jalali wal-Ikram", "Possessor of Majesty and Honour"],
  ["الْمُقْسِطُ", "Al-Muqsit", "The Equitable"],
  ["الْجَامِعُ", "Al-Jami", "The Gatherer"],
  ["الْغَنِيُّ", "Al-Ghani", "The Self-Sufficient"],
  ["الْمُغْنِي", "Al-Mughni", "The Enricher"],
  ["الْمَانِعُ", "Al-Mani", "The Preventer"],
  ["الضَّارُّ", "Ad-Darr", "The One who allows harm"],
  ["النَّافِعُ", "An-Nafi", "The One who brings benefit"],
  ["النُّورُ", "An-Nur", "The Light"],
  ["الْهَادِي", "Al-Hadi", "The Guide"],
  ["الْبَدِيعُ", "Al-Badi", "The Originator without precedent"],
  ["الْبَاقِي", "Al-Baqi", "The Everlasting"],
  ["الْوَارِثُ", "Al-Warith", "The Inheritor"],
  ["الرَّشِيدُ", "Ar-Rashid", "The Guide to the Right Path"],
  ["الصَّبُورُ", "As-Sabur", "The Patient"],
] as const;

export const namesOfAllahInput = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("A name or meaning to look up, in Arabic or English. Leave it out for the full list"),
});

const folded = (text: string) =>
  text
    .normalize("NFKD")
    .replaceAll(/\p{M}|ـ/gu, "")
    .toLowerCase()
    .replaceAll(/[^\p{L}]+/gu, "");

export const namesOfAllah = (input: z.input<typeof namesOfAllahInput>) => {
  const { query } = namesOfAllahInput.parse(input);
  const names = NAMES.map(([arabic, transliteration, meaning], index) => ({
    number: index + 1,
    arabic,
    transliteration,
    meaning,
  }));
  const wanted = query === undefined ? "" : folded(query);
  return {
    names: names.filter((name) =>
      [name.arabic, name.transliteration, name.meaning].some((text) =>
        folded(text).includes(wanted),
      ),
    ),
    list: "tirmidhi:3507",
    confirmedBy: ["bukhari:2736", "bukhari:7392", "muslim:2677a"],
    note: "That Allah has 99 names is authentic in Bukhari and Muslim. This list of them comes from tirmidhi:3507, which Ahmad Shakir, al-Albani and Zubair Ali Zai grade da'if, and scholars have compiled other lists. The English meanings are short renderings, not a translation of the hadith.",
  };
};
