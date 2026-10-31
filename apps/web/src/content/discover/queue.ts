import type { ArticleInput } from "./schema";

export const queue = [
  { title: "Does wudu need an intention?", slug: "intention-in-wudu", topic: "Purification" },
  {
    title: "Must you wipe the whole head in wudu?",
    slug: "wiping-the-head-in-wudu",
    topic: "Purification",
  },
  {
    title: "Does touching your private parts break wudu?",
    slug: "touching-private-parts-and-wudu",
    topic: "Purification",
  },
  { title: "Does sleep break wudu?", slug: "sleep-and-wudu", topic: "Purification" },
  {
    title: "Can you wipe over cotton socks in wudu?",
    slug: "wiping-over-socks",
    topic: "Purification",
  },
  {
    title: "Is the basmala said aloud in prayer?",
    slug: "basmala-aloud-in-prayer",
    topic: "Prayer",
  },
  {
    title: "Do you raise your hands before and after ruku'?",
    slug: "raising-the-hands-in-prayer",
    topic: "Prayer",
  },
  {
    title: "Do you recite al-Fatiha behind the imam?",
    slug: "fatiha-behind-the-imam",
    topic: "Prayer",
  },
  { title: "Is witr prayer obligatory?", slug: "is-witr-obligatory", topic: "Prayer" },
  {
    title: "Can you join prayers when you travel?",
    slug: "joining-prayers-when-travelling",
    topic: "Prayer",
  },
  {
    title: "Whose moon sighting do you follow for Ramadan?",
    slug: "moon-sighting-for-ramadan",
    topic: "Fasting",
  },
  { title: "Does cupping break the fast?", slug: "cupping-and-the-fast", topic: "Fasting" },
  { title: "Does an injection break the fast?", slug: "injections-and-the-fast", topic: "Fasting" },
  { title: "Can zakat al-fitr be paid in money?", slug: "zakat-al-fitr-in-money", topic: "Zakat" },
  {
    title: "Must you make up missed fasts before the six days of Shawwal?",
    slug: "making-up-fasts-before-shawwal",
    topic: "Fasting",
  },
  { title: "Does vomiting break wudu?", slug: "vomiting-and-wudu", topic: "Purification" },
  {
    title: "Does laughing in prayer break wudu?",
    slug: "laughing-in-prayer-and-wudu",
    topic: "Purification",
  },
  { title: "Is tayammum one strike or two?", slug: "strikes-in-tayammum", topic: "Purification" },
  { title: "Is a dog's saliva impure?", slug: "dog-saliva-and-purity", topic: "Purification" },
  {
    title: "Where do you place your hands in prayer?",
    slug: "placing-the-hands-in-prayer",
    topic: "Prayer",
  },
  { title: "Is Amin said aloud in prayer?", slug: "saying-amin-aloud", topic: "Prayer" },
  { title: "Is qunut said in Fajr every day?", slug: "qunut-in-fajr", topic: "Prayer" },
  {
    title: "Do you move your finger in the tashahhud?",
    slug: "moving-the-finger-in-tashahhud",
    topic: "Prayer",
  },
  {
    title: "Is the resting sit before standing a sunnah?",
    slug: "resting-sit-in-prayer",
    topic: "Prayer",
  },
  {
    title: "Are there two rak'ahs before Maghrib?",
    slug: "two-rakahs-before-maghrib",
    topic: "Prayer",
  },
  {
    title: "How far must you travel to shorten prayer?",
    slug: "travel-distance-for-shortening-prayer",
    topic: "Prayer",
  },
  {
    title: "Is shortening prayer on a journey obligatory?",
    slug: "is-shortening-prayer-obligatory",
    topic: "Prayer",
  },
  {
    title: "How many people does Friday prayer need?",
    slug: "friday-prayer-congregation-size",
    topic: "Prayer",
  },
  {
    title: "Is there zakat on gold jewellery you wear?",
    slug: "zakat-on-worn-jewellery",
    topic: "Zakat",
  },
  { title: "Is zakat due on money owed to you?", slug: "zakat-on-debts-owed", topic: "Zakat" },
] as const satisfies readonly Pick<ArticleInput, "title" | "slug" | "topic">[];
