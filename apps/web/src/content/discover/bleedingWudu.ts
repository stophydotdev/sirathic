import type { ArticleInput } from "./schema";

const QURAN_5_6 = "https://quran.com/5/6";
const QURAN_6_145 = "https://quran.com/6/145";
const NASAI_215 = "https://sunnah.com/nasai:215";
const ABUDAWUD_304 = "https://sunnah.com/abudawud:304";
const TIRMIDHI_87 = "https://sunnah.com/tirmidhi:87";
const HIDAYAH = "https://shamela.ws/book/11820#1:17";
const RADD_AL_MUHTAR = "https://islamqa.org/hanafi/qibla-hanafi/34956/bleeding-breaking-wudu/";
const MUDAWWANAH = "https://shamela.ws/book/587#1:125";
const MUGHNI = "https://shamela.ws/book/6910#1:248";
const MUGHNI_IMPURITY = "https://shamela.ws/book/6910#2:481";
const KASHSHAF = "https://shamela.ws/book/622#1:283";
const KASHSHAF_IMPURITY = "https://shamela.ws/book/622#1:437";
const SEEKERS =
  "https://seekersguidance.org/answers/purity/does-bleeding-invalidate-wudu-ablution/";
const ISLAMQA_45666 = "https://islamqa.info/ar/answers/45666";
const ISLAMQA_2570 = "https://islamqa.info/en/answers/2570";
const ISLAMWEB = "https://www.islamweb.net/en/fatwa/87720/";
const AMJA = "https://www.amjaonline.org/fatwa/ar/2523/هل-ينتقض-وضوء-المتبرع-بالدم";
const DAR_AL_IFTA_WOUND =
  "https://www.dar-alifta.org/ar/Fatwa/Details/13523/حكم-التطهر-من-الدم-الخارج-من-غير-السبيلين";
const DAR_AL_IFTA_NOSE =
  "https://www.dar-alifta.org/ar/Fatwa/Details/18044/حكم-الوضوء-من-الدم-الخارج-من-الأنف";
const ISLAMONLINE_EFFECT =
  "https://fiqh.islamonline.net/%d8%a3%d8%ab%d8%b1-%d8%ae%d8%b1%d9%88%d8%ac-%d8%a7%d9%84%d8%af%d9%85-%d8%b9%d9%84%d9%89-%d8%a7%d9%84%d9%88%d8%b6%d9%88%d8%a1/";
const ISLAMONLINE_EN = "https://fiqh.islamonline.net/en/does-bleeding-break-wudu/";
const TOHED = "https://en.tohed.com/threads/does-wudu-ablution-break-due-to-bleeding.515/";

export default {
  title: "Does bleeding break wudu?",
  headline: "Two schools say bleeding breaks wudu, and two say it does not",
  cover: "خروج الدم",
  slug: "bleeding-and-wudu",
  topic: "Purification",
  tint: "rose",
  updated: "2026-10-31",
  reviewed: false,
  summary: {
    text: "The schools split over blood from a wound, a nosebleed or cupping. Hanafis say flowing blood breaks wudu, Hanbalis say a large amount does, and Malikis and Shafi'is say it does not. Many recent fatwas favour no break and advise renewing wudu to leave the disagreement.",
    citations: [ISLAMQA_45666, ISLAMWEB, AMJA],
  },
  verse: {
    arabic: "أَوْ جَآءَ أَحَدٌ مِّنكُم مِّنَ ٱلْغَآئِطِ",
    translation: "…or one of you comes from the place of relieving himself…",
    reference: "Al-Ma'idah 5:6",
    url: QURAN_5_6,
  },
  sources: [
    { url: QURAN_5_6, title: "Al-Ma'idah 5:6, the purification verse" },
    { url: NASAI_215, title: "Sunan an-Nasa'i 215" },
    { url: MUGHNI, title: "Ibn Qudamah, al-Mughni" },
    { url: ISLAMQA_45666, title: "Does blood leaving the body break wudu?" },
    { url: ISLAMWEB, title: "Bleeding and loss of Wudu" },
    { url: AMJA, title: "AMJA fatwa 2523, does a blood donor's wudu break?" },
    { url: ISLAMONLINE_EFFECT, title: "IslamOnline Fiqh, the effect of bleeding on wudu" },
    { url: HIDAYAH, title: "al-Marghinani, al-Hidayah" },
    { url: QURAN_6_145, title: "Al-An'am 6:145" },
    { url: SEEKERS, title: "Does Bleeding Invalidate Wudu (Ablution)?" },
    { url: ABUDAWUD_304, title: "Sunan Abi Dawud 304" },
    { url: TIRMIDHI_87, title: "Jami` at-Tirmidhi 87" },
    { url: ISLAMQA_2570, title: "Does Blood Donation Break Wudu?" },
    { url: TOHED, title: "Does Wudu (Ablution) Break Due to Bleeding?" },
    { url: RADD_AL_MUHTAR, title: "Bleeding breaking wudu, Hanafi answer" },
    { url: MUDAWWANAH, title: "Malik, al-Mudawwanah" },
    {
      url: DAR_AL_IFTA_WOUND,
      title: "Dar al-Ifta (Egypt), purification from blood that leaves other than the two passages",
    },
    { url: DAR_AL_IFTA_NOSE, title: "Dar al-Ifta (Egypt), wudu after blood from the nose" },
    { url: KASHSHAF, title: "Kashshaf al-Qina'" },
    { url: MUGHNI_IMPURITY, title: "Ibn Qudamah, al-Mughni, on blood as an impurity" },
    { url: KASHSHAF_IMPURITY, title: "Kashshaf al-Qina', on blood as an impurity" },
    { url: ISLAMONLINE_EN, title: "Does Bleeding Break Wudu?" },
  ],
  sections: [
    {
      heading: "What the Quran says",
      paragraphs: [
        {
          text: "The wudu verse names coming from the place of relieving himself and contact with women. It does not mention blood from a wound, a nosebleed, cupping or a blood draw.",
          citations: [QURAN_5_6],
        },
        {
          text: "Those who say blood does not break wudu read the verse as a limited list of causes, and hold that acts of worship are limited to what the text reveals.",
          citations: [ISLAMQA_45666, ISLAMONLINE_EFFECT],
        },
        {
          text: 'Hanafis take "the place of relieving himself" as the base for the two passages, then extend it by analogy to impure blood that flows from the body.',
          citations: [HIDAYAH],
        },
        {
          text: "Al-An'am 6:145 lists blood spilled out among what is forbidden to eat, and scholars use it to show that blood is impure. Impurity is a separate question from whether blood breaks wudu.",
          citations: [QURAN_6_145, SEEKERS],
        },
      ],
    },
    {
      heading: "What the hadith show",
      paragraphs: [
        {
          text: "The Prophet ﷺ told Fatimah bint Abi Hubaish, who suffered from istihadah, to stop praying for menstrual blood and to perform wudu for any other bleeding, since it is just a vein. It is graded sahih in the Darussalam edition.",
          citations: [NASAI_215],
        },
        {
          text: "Abu Dawud has a version of the same report, graded hasan by al-Albani.",
          citations: [ABUDAWUD_304],
        },
        {
          text: "Abu al-Darda said the Prophet ﷺ vomited and performed wudu. It is graded hasan in the Darussalam edition, while al-Nawawi called it weak and mudtarib.",
          citations: [TIRMIDHI_87, ISLAMQA_45666],
        },
        {
          text: "Al-Nawawi cites a report from Anas that the Prophet ﷺ was cupped and prayed without wudu, washing only the cupping sites.",
          citations: [SEEKERS],
        },
        {
          text: "A Companion shot with arrows while praying at Dhat al-Riqa' kept praying while blood flowed, and the Prophet ﷺ did not object. Abu Dawud narrates it with a sound chain, according to al-Nawawi.",
          citations: [SEEKERS, ISLAMONLINE_EFFECT],
        },
        {
          text: "Umar is reported to have prayed while his wound poured blood, and Ibn Umar to have squeezed a boil and prayed without wudu.",
          citations: [ISLAMQA_2570, TOHED],
        },
      ],
    },
    {
      heading: "How the four schools rule",
      paragraphs: [
        {
          text: "Hanafis say blood and pus that flow beyond the wound to a place washed in wudu break it. Blood the person squeezes out, without it flowing, does not.",
          citations: [HIDAYAH, RADD_AL_MUHTAR],
        },
        {
          text: "Malikis say blood from other than the two passages does not break wudu, though flowing blood from a wound can invalidate the prayer until it is washed, with the nosebleed treated separately.",
          citations: [MUDAWWANAH, DAR_AL_IFTA_WOUND],
        },
        {
          text: "Shafi'is say blood from other than the two passages does not break wudu, little or much. In prayer a small amount from a wound is excused, while a substantial nosebleed means stopping, washing and renewing wudu.",
          citations: [SEEKERS, DAR_AL_IFTA_NOSE],
        },
        {
          text: "Hanbalis say a large amount of blood from other than the two passages breaks wudu, and a small amount does not.",
          citations: [MUGHNI, KASHSHAF],
        },
      ],
    },
    {
      heading: "How scholars reconciled the evidence",
      paragraphs: [
        {
          text: "The woman with istihadah was told to perform wudu, which suggests blood can require it. Most reply that her blood comes from the private passage, a place of hadath, and not from anywhere in the body. Al-Nawawi said that if the report is authentic, it means this blood is not menstruation but requires wudu because it exits from the place of hadath.",
          citations: [ISLAMQA_45666, NASAI_215],
        },
        {
          text: "The vomiting hadith is answered three ways. It is weak and mudtarib, an act of the Prophet ﷺ shows wudu is recommended and not obligatory, and it concerns vomit, not blood.",
          citations: [ISLAMQA_45666, ISLAMONLINE_EFFECT],
        },
        {
          text: "Hanafis explain the boil that Ibn Umar squeezed by saying the blood was extracted and did not flow out, so it does not break wudu. Hanbalis read the Companion reports as showing that a little blood does not break it.",
          citations: [HIDAYAH, MUGHNI, KASHSHAF],
        },
        {
          text: "Shafi'is say the arrow incident involved blood that did not soil the clothes excessively, and that this small amount is excused.",
          citations: [SEEKERS],
        },
        {
          text: "Many scholars separate impurity from nullification. Blood is impure, so a substantial amount must be washed from the body and clothes for prayer, but that does not automatically break wudu.",
          citations: [SEEKERS, MUGHNI_IMPURITY, KASHSHAF_IMPURITY],
        },
      ],
    },
    {
      heading: "What recent fatwas say",
      paragraphs: [
        {
          text: "IslamQA fatwa 45666 says many scholars hold that impurity leaving the body does not break wudu, since the default is that wudu stays valid until proof shows otherwise.",
          citations: [ISLAMQA_45666],
        },
        {
          text: "Egypt's Dar al-Ifta says Malikis and Shafi'is hold that nosebleed and wound blood do not break wudu, and it recommends renewing wudu after a nosebleed.",
          citations: [DAR_AL_IFTA_WOUND, DAR_AL_IFTA_NOSE],
        },
        {
          text: "Islamweb says the most preponderant opinion is that blood from other than the private parts does not break wudu, whether from injury, cupping or a nosebleed, and that making wudu to avoid the difference is more appropriate.",
          citations: [ISLAMWEB],
        },
        {
          text: "AMJA says Abu Hanifah and Ahmad hold that much blood breaks wudu, while Malik and al-Shafi'i do not, and advises renewing wudu to leave the disagreement.",
          citations: [AMJA],
        },
        {
          text: "IslamOnline says bleeding from a cut or wound does not break wudu, while bleeding from the two natural orifices does.",
          citations: [ISLAMONLINE_EN],
        },
      ],
    },
  ],
  related: [],
} satisfies ArticleInput;
