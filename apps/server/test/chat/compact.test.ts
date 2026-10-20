import { expect, test } from "bun:test";
import {
  hadithBlock,
  pageText,
  quranBlock,
  unvowel,
} from "../../src/chat/compact";

test("unvowel drops vowel marks but keeps letters, hamzas and digits", () => {
  expect(unvowel("إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ ٣")).toBe("إنما الأعمال بالنيات ٣");
});

test("every verse keeps its Arabic, and hadith Arabic is unvowelled", () => {
  const verse = {
    citation: 1,
    arabic: "فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا",
    english: "For indeed, with hardship will be ease.",
    tafsir: null,
  };
  const quran = quranBlock([
    { ...verse, ref: "Quran 94:5 (Ash-Sharh)" },
    { ...verse, citation: 2, ref: "Quran 94:6 (Ash-Sharh)" },
  ]);
  expect(quran.match(/فَإِنَّ/gu)).toHaveLength(2);
  expect(quran).toContain("[2] Quran 94:6 (Ash-Sharh)");

  const hadith = hadithBlock([
    {
      citation: 3,
      ref: "Sahih al-Bukhari 1",
      english: null,
      arabic: "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ",
      grade: "Sahih",
    },
  ]);
  expect(hadith).toBe(
    "## hadith\n[3] Sahih al-Bukhari 1 (Sahih)\nإنما الأعمال بالنيات",
  );
});

test("a long hadith reaches the model whole, with the collector's verdict", () => {
  const narration = "حدثنا قتيبة حدثنا الليث عن ابن شهاب ".repeat(8);
  const block = hadithBlock([
    {
      citation: 4,
      ref: "Jami' at-Tirmidhi 2107",
      english: null,
      arabic: `${narration}قال أبو عيسى هذا حديث حسن صحيح`,
      grade: null,
    },
  ]);
  expect(block).toContain(`${narration}قال أبو عيسى هذا حديث حسن صحيح`);
});

test("a page keeps its text with links reduced to their words, up to the limit", () => {
  const page =
    "# Combining prayers\n\n\n\nThe [Hanafi school](https://example.com/hanafi) allows it only at Arafah. ![map](https://example.com/map.png)";
  expect(pageText(page, 1000)).toBe(
    "# Combining prayers\n\nThe Hanafi school allows it only at Arafah.",
  );
  expect(pageText(page, 18)).toBe("# Combining prayer…");
});

test("a page loses its menus, buttons, footnote links and repeated captions", () => {
  const page = [
    "×",
    "  - [Zakat](https://example.com/zakat)",
    "[![Quiz](https://example.com/q.jpg)](https://example.com/quiz)",
    "Share",
    "A fresco of the battle.",
    "Badr was fought in 624.[\\[1\\]](https://en.wikipedia.org/wiki/Badr#cite_note-1)",
    '| Location | [Badr](https://en.wikipedia.org/wiki/Badr_(city) "Badr (city)") |',
    "A fresco of the battle.",
  ].join("\n");
  expect(pageText(page, 1000)).toBe(
    "A fresco of the battle.\nBadr was fought in 624.\n| Location | Badr |",
  );
});
