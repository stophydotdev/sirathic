import type { ArticleInput } from "./schema";

const QURAN_5_6 = "https://quran.com/5/6";
const QURAN_4_43 = "https://quran.com/4/43";
const BUKHARI_513 = "https://sunnah.com/bukhari:513";
const MUSLIM_486 = "https://sunnah.com/muslim:486";
const NASAI_169 = "https://sunnah.com/nasai:169";
const NASAI_170 = "https://sunnah.com/nasai:170";
const MUGHNI = "https://shamela.ws/book/6910#1:256";
const FATWA_1405 = "https://al-fatawa.com/en/fatwa/110654/man-touching-woman-directly";
const ISLAMONLINE_STRANGER =
  "https://fiqh.islamonline.net/%d9%84%d9%85%d8%b3-%d8%a7%d9%84%d8%a3%d8%ac%d9%86%d8%a8%d9%8a%d8%a9-%d9%88%d9%86%d9%82%d8%b6-%d8%a7%d9%84%d9%88%d8%b6%d9%88%d8%a1/";
const ISLAMONLINE_WIFE =
  "https://fiqh.islamonline.net/%d8%a3%d8%ab%d8%b1-%d9%84%d9%85%d8%b3-%d8%a7%d9%84%d8%b2%d9%88%d8%ac%d8%a9-%d8%b9%d9%84%d9%89-%d8%a7%d9%84%d9%88%d8%b6%d9%88%d8%a1/";
const ISLAMQA_76115 = "https://islamqa.info/en/answers/76115";
const ISLAMQA_769 = "https://islamqa.info/en/answers/769";
const DARUL_IFTAA =
  "https://islamqa.org/hanafi/darul-iftaa-chicago/271117/does-touching-a-non-mahram-invalidate-wudu-for-hanafis/";
const BIDAYAT = "https://shamela.ws/book/21739#1:40";
const DASUQI = "https://shamela.ws/book/21604#1:122";
const MUGHNI_MUHTAJ_RULING = "https://shamela.ws/book/11444#1:145";
const MUGHNI_MUHTAJ_REPLY = "https://shamela.ws/book/11444#1:146";
const KASHSHAF = "https://shamela.ws/book/622#1:283";
const IBN_BAZ = "https://al-fatawa.com/en/fatwa/70730/ruling-touching-woman-after-performing-wudu";
const DAR_AL_IFTA =
  "https://www.dar-alifta.org/ar/Fatwa/Details/17108/%D9%85%D8%AF%D9%89-%D8%A7%D9%86%D8%AA%D9%82%D8%A7%D8%B6-%D8%A7%D9%84%D9%88%D8%B6%D9%88%D8%A1-%D8%A8%D9%84%D9%85%D8%B3-%D8%A7%D9%84%D9%85%D8%B1%D8%A3%D8%A9";

export default {
  title: "Does touching a woman break wudu?",
  slug: "touching-a-woman-and-wudu",
  topic: "Purification",
  updated: "2026-10-31",
  reviewed: false,
  summary: {
    text: "The four schools give three answers. Hanafis say it never breaks wudu, Shafi'is say skin contact with a non-mahram woman does, and Malikis and Hanbalis say it does only with desire. Most recent fatwa bodies hold that touching alone does not break it.",
    citations: [ISLAMONLINE_STRANGER, ISLAMQA_76115],
  },
  verse: {
    arabic: "أَوْ لَـٰمَسْتُمُ ٱلنِّسَآءَ",
    translation: "…or you have contacted women…",
    reference: "Al-Ma'idah 5:6",
    url: QURAN_5_6,
  },
  sources: [
    { url: QURAN_5_6, title: "Al-Ma'idah 5:6, the purification verse" },
    { url: BUKHARI_513, title: "Sahih al-Bukhari 513" },
    { url: MUGHNI, title: "Ibn Qudamah, al-Mughni" },
    { url: FATWA_1405, title: "Permanent Committee, fatwa 1405" },
    { url: QURAN_4_43, title: "An-Nisa' 4:43" },
    { url: ISLAMONLINE_STRANGER, title: "IslamOnline Fiqh, touching a non-mahram woman and wudu" },
    { url: ISLAMQA_76115, title: "Does Touching a Woman Invalidate Wudu?" },
    { url: DARUL_IFTAA, title: "Darul Iftaa Chicago, does touching a non-mahram invalidate wudu" },
    { url: ISLAMQA_769, title: "Does Touching Wife Break Wudu?" },
    { url: ISLAMONLINE_WIFE, title: "IslamOnline Fiqh, the effect of touching a wife on wudu" },
    { url: BIDAYAT, title: "Ibn Rushd, Bidayat al-Mujtahid" },
    { url: MUSLIM_486, title: "Sahih Muslim 486" },
    { url: NASAI_169, title: "Sunan an-Nasa'i 169" },
    { url: NASAI_170, title: "Sunan an-Nasa'i 170" },
    { url: DASUQI, title: "al-Dardir, al-Sharh al-Kabir, with the Hashiyat of al-Dasuqi" },
    { url: MUGHNI_MUHTAJ_RULING, title: "Mughni al-Muhtaj, on touching" },
    { url: KASHSHAF, title: "Kashshaf al-Qina'" },
    { url: MUGHNI_MUHTAJ_REPLY, title: "Mughni al-Muhtaj, on the hadith of touch" },
    { url: IBN_BAZ, title: "Ibn Baz, the ruling on touching a woman after wudu" },
    { url: DAR_AL_IFTA, title: "Dar al-Ifta (Egypt), how far wudu breaks by touching a woman" },
  ],
  sections: [
    {
      heading: "One word, two readings",
      paragraphs: [
        {
          text: "The question turns on one word in the purification verse, repeated in An-Nisa' 4:43. Most reciters read it لامستم, while Hamzah and al-Kisa'i read it لمستم, and both sides used the verse as evidence.",
          citations: [DARUL_IFTAA, QURAN_4_43],
        },
        {
          text: "The Companions read it differently. Ibn Abbas took it to mean intercourse, not hand contact. Ibn Mas'ud and Ibn Umar took it as touch and counted a kiss within it.",
          citations: [ISLAMQA_769, ISLAMONLINE_WIFE],
        },
        {
          text: "Ibn Rushd traced the whole dispute to Arabic using the word for both meanings.",
          citations: [BIDAYAT],
        },
      ],
    },
    {
      heading: "What the hadith show",
      paragraphs: [
        {
          text: "Aisha said that when the Prophet ﷺ prostrated, he pushed her feet and she withdrew them.",
          citations: [BUKHARI_513],
        },
        {
          text: "One night her hand touched the soles of his feet while he was in prostration.",
          citations: [MUSLIM_486, NASAI_169],
        },
        {
          text: "The report that he kissed one of his wives and then prayed without wudu is graded hasan in the Darussalam edition. An-Nasa'i called it mursal and the best report on the chapter, and graders differ on it.",
          citations: [NASAI_170, BIDAYAT],
        },
      ],
    },
    {
      heading: "How the four schools rule",
      paragraphs: [
        {
          text: "Hanafis hold that touching never breaks wudu, with or without desire.",
          citations: [DARUL_IFTAA],
        },
        {
          text: "Malikis say it breaks only with desire or when seeking it.",
          citations: [DASUQI],
        },
        {
          text: "Shafi'is say skin contact with a non-mahram woman breaks it, with or without desire.",
          citations: [MUGHNI_MUHTAJ_RULING],
        },
        {
          text: "The mashhur Hanbali view makes desire the condition.",
          citations: [MUGHNI],
        },
      ],
    },
    {
      heading: "How scholars reconciled the evidence",
      paragraphs: [
        {
          text: "The verse seems to make touching a cause of wudu, while the hadith show the Prophet ﷺ touching his wives and praying on. Hanafis read the verse as intercourse, so nothing conflicts.",
          citations: [MUGHNI],
        },
        {
          text: "Malikis and Hanbalis keep both texts and make desire the condition.",
          citations: [KASHSHAF],
        },
        {
          text: "Shafi'is read the verse as skin on skin and note the hadith may describe touch over a covering.",
          citations: [MUGHNI_MUHTAJ_REPLY],
        },
      ],
    },
    {
      heading: "What recent fatwas say",
      paragraphs: [
        {
          text: "The Permanent Committee held that touching does not break wudu, with or without desire.",
          citations: [FATWA_1405],
        },
        {
          text: "Ibn Baz agreed, with exceptions for touching private parts and for a discharge.",
          citations: [IBN_BAZ],
        },
        {
          text: "Egypt's Dar al-Ifta set out the Maliki and Hanafi views and said the Hanafi one may be followed by someone facing the problem.",
          citations: [DAR_AL_IFTA],
        },
      ],
    },
  ],
  related: [],
} satisfies ArticleInput;
