import { expect, test } from "bun:test";
import { unmatchedQuotes } from "../apps/server/src/chat/quotes";

test("a cited quote must match what the tools returned word for word, honorifics and vowel marks aside", () => {
  const hadith =
    "The Companions of Muhammad (peace and blessings be upon him) did not regard the abandonment of any deed as disbelief (kufr), except for the prayer.";
  const kept =
    "The Companions of Muhammad ﷺ did not regard the abandonment of any deed as disbelief except for the prayer.";
  const changed = kept.replace("the prayer", "fasting");
  const example =
    'Saying "he is always late to meetings, and it drives everyone mad" is backbiting.';
  const answer = (quote: string) =>
    `He said: "${quote}" (Tirmidhi 2622)[1]\n\n${example}\n\n> إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى`;
  const sources = [hadith, "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى"];
  expect(unmatchedQuotes(answer(kept), sources)).toEqual([]);
  expect(unmatchedQuotes(answer(changed), sources)).toEqual([changed]);
  expect(
    unmatchedQuotes('> "For indeed, with hardship will be ease." (Quran 94:5)[4]', [
      "For indeed, with hardship [will be] ease [i.e., relief].",
    ]),
  ).toEqual([]);
  const linked = '"For indeed, with hardship will come great ease." [4](https://quran.com/94/5)';
  expect(
    unmatchedQuotes(linked, ["For indeed, with hardship [will be] ease [i.e., relief]."]),
  ).toEqual(["For indeed, with hardship will come great ease."]);
});
