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
] as const satisfies readonly Pick<ArticleInput, "title" | "slug" | "topic">[];
