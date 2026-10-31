import type { ArticleInput } from "./schema";

const QURAN_5_6 = "https://quran.com/5/6";
const QURAN_2_173 = "https://quran.com/2/173";
const QURAN_6_145 = "https://quran.com/6/145";
const QURAN_16_115 = "https://quran.com/16/115";
const MUSLIM_360 = "https://sunnah.com/muslim:360a";
const IBN_MAJAH_495 = "https://sunnah.com/ibnmajah:495";
const IBN_MAJAH_493 = "https://sunnah.com/ibnmajah:493";
const TIRMIDHI_81 = "https://sunnah.com/tirmidhi:81";
const TIRMIDHI_1829 = "https://sunnah.com/tirmidhi:1829";
const NASAI_185 = "https://sunnah.com/nasai:185";
const ABUDAWUD_192 = "https://sunnah.com/abudawud:192";
const MUGHNI = "https://shamela.ws/book/6910#1:250";
const KASHSHAF = "https://shamela.ws/book/622#1:283";
const MUFTIONLINE =
  "https://islamqa.org/hanafi/muftionline/130759/will-wudhu-break-through-eating-camel-meat/";
const DEOBAND =
  "https://islamqa.org/hanafi/darulifta-deoband/28114/can-a-person-eat-camel-meat-and-still-perform-wudhu/";
const BIRMINGHAM =
  "https://islamqa.org/hanafi/daruliftaa-birmingham/136110/does-eating-camel-meat-necessitate-the-making-of-wudhu/";
const ASKIMAM =
  "https://islamqa.org/hanafi/askimam/123862/does-eating-camel-meat-invalidate-ones-wudhu/";
const JORDAN =
  "https://islamqa.org/shafii/darul-iftaa-jordan/226010/does-eating-camel-meat-invalidate-ones-wudou/";
const DAR_AL_IFTA =
  "https://www.dar-alifta.org/ar/Fatwa/Details/11126/هل-أكل-لحوم-الإبل-ينقض-الوضوء؟";
const DAR_AL_IFTA_EN =
  "https://www.dar-alifta.org/en/fatwa/details/7826/does-camel-meat-break-ablution";
const AMJA = "https://www.amjaonline.org/fatwa/ar/3206/حكم-الوضوء-من-أكل-لحوم-الإبل";
const ISLAMQA_7103 = "https://islamqa.info/en/answers/7103";
const ISLAMQA_PARTS = "https://islamqa.info/ar/answers/177086";
const ISLAMONLINE_RECOMMENDED =
  "https://fiqh.islamonline.net/%d8%a3%d9%83%d9%84-%d9%84%d8%ad%d9%88%d9%85-%d8%a7%d9%84%d8%a5%d8%a8%d9%84-%d9%88%d8%a3%d8%ab%d8%b1%d9%87-%d8%b9%d9%84%d9%89-%d8%a7%d9%84%d9%88%d8%b6%d9%88%d8%a1/";
const COMMITTEE =
  "https://al-fatawa.com/en/fatwa/110663/ruling-performing-wudu-after-eating-camel-fat-offal-intestines";
const IBN_BAZ_MEAT =
  "https://al-fatawa.com/en/fatwa/72335/ruling-performing-wudu-after-eating-camel-meat-72335";
const IBN_BAZ_PRAYER =
  "https://al-fatawa.com/en/fatwa/89162/what-ruling-prayer-one-who-did-not-perform-wudu-after-eating-camel-meat";
const IBN_BAZ_FAT =
  "https://al-fatawa.com/en/fatwa/90599/ruling-performing-wudu-after-eating-camel-fat";
const UTHAYMEEN_EVIDENCE =
  "https://al-fatawa.com/en/fatwa/37177/evidence-eating-camel-meat-invalidates-wudu";
const UTHAYMEEN_WISDOM =
  "https://al-fatawa.com/en/fatwa/41678/eating-camel-meat-invalidates-wudu-mentioning-wisdom-behind";
const UTHAYMEEN_ABROGATE =
  "https://al-fatawa.com/en/fatwa/37272/hadith-last-prophet-s-commands-leave-off-ablution-what-has-touched-fire-does-abrogate-hadith";
const UTHAYMEEN_ALL =
  "https://al-fatawa.com/en/fatwa/35503/word-shaykh-things-invalidate-wudu-first-among-things-invalidate-wudu-eating-camel-meat-evidence";
const ALBANI =
  "https://al-fatawa.com/en/fatwa/23831/what-ruling-performing-wudu-after-eating-camel-meat-shaykhs-advice-regarding-not-habituating-oneself";
const ISLAMWEB_COOKED = "https://www.islamweb.net/en/fatwa/198553/";
const ISLAMWEB_IMAM = "https://www.islamweb.net/en/fatwa/250645/";
const ISLAMWEB_IMAM_RENEW = "https://www.islamweb.net/en/fatwa/56956/";

export default {
  title: "Does eating camel meat break wudu?",
  slug: "camel-meat-and-wudu",
  topic: "Purification",
  updated: "2026-10-31",
  reviewed: false,
  summary: {
    text: "Two sets of sound reports pull in different directions. Hanafis, Malikis and the newer Shafi'i view say camel meat does not break wudu, while Hanbalis say it does. Recent fatwa bodies split along the same lines.",
    citations: [ISLAMWEB_COOKED, AMJA],
  },
  sources: [
    { url: MUSLIM_360, title: "Sahih Muslim 360a" },
    { url: QURAN_5_6, title: "Al-Ma'idah 5:6, the purification verse" },
    { url: MUGHNI, title: "Ibn Qudamah, al-Mughni" },
    { url: ISLAMWEB_COOKED, title: "Does eating cooked camel meat invalidate ablution" },
    { url: AMJA, title: "AMJA fatwa 3206, wudu after eating camel meat" },
    { url: MUFTIONLINE, title: "Will wudhu break through eating camel meat?" },
    { url: KASHSHAF, title: "Kashshaf al-Qina'" },
    { url: QURAN_2_173, title: "Al-Baqarah 2:173" },
    { url: QURAN_6_145, title: "Al-An'am 6:145" },
    { url: QURAN_16_115, title: "An-Nahl 16:115" },
    { url: IBN_MAJAH_495, title: "Sunan Ibn Majah 495" },
    { url: TIRMIDHI_81, title: "Jami` at-Tirmidhi 81" },
    {
      url: UTHAYMEEN_EVIDENCE,
      title: "Ibn Uthaymeen, is there evidence that eating camel meat invalidates wudu?",
    },
    { url: NASAI_185, title: "Sunan an-Nasa'i 185" },
    { url: ABUDAWUD_192, title: "Sunan Abi Dawud 192" },
    { url: TIRMIDHI_1829, title: "Jami` at-Tirmidhi 1829" },
    { url: IBN_MAJAH_493, title: "Sunan Ibn Majah 493" },
    {
      url: DEOBAND,
      title: "Darul Ifta Deoband, can a person eat camel meat and still perform wudhu?",
    },
    { url: BIRMINGHAM, title: "Darul Iftaa Birmingham, does eating camel meat necessitate wudhu?" },
    {
      url: DAR_AL_IFTA,
      title: "Dar al-Ifta (Egypt), does eating camel meat break wudu? (fatwa 215)",
    },
    { url: JORDAN, title: "Dar al-Ifta Jordan, does eating camel meat invalidate one's wudu?" },
    { url: IBN_BAZ_FAT, title: "Ibn Baz, ruling on wudu after eating camel fat" },
    { url: ISLAMQA_PARTS, title: "IslamQA, eating the parts of the camel other than meat" },
    {
      url: UTHAYMEEN_ALL,
      title: "Ibn Uthaymeen, the first thing that invalidates wudu is camel meat",
    },
    { url: DAR_AL_IFTA_EN, title: "Dar al-Ifta (Egypt), does camel meat break ablution?" },
    { url: ISLAMQA_7103, title: "Does Eating Camel Meat Break Your Wudu?" },
    {
      url: UTHAYMEEN_ABROGATE,
      title: "Ibn Uthaymeen, does the hadith of leaving wudu after what fire touched abrogate it?",
    },
    { url: IBN_BAZ_MEAT, title: "Ibn Baz, ruling on wudu after eating camel meat" },
    { url: ASKIMAM, title: "Does eating camel meat invalidate one's wudhu?" },
    {
      url: ISLAMONLINE_RECOMMENDED,
      title: "IslamOnline Fiqh, eating camel meat and its effect on wudu",
    },
    {
      url: ISLAMWEB_IMAM,
      title: "Praying behind an Imaam who ate camel meat and did not repeat his Wudhoo'",
    },
    {
      url: ISLAMWEB_IMAM_RENEW,
      title: "Praying behind an Imaam who does not renew his Wudhoo' after eating camel meat",
    },
    { url: COMMITTEE, title: "Permanent Committee, fatwa 1257" },
    {
      url: IBN_BAZ_PRAYER,
      title: "Ruling on the prayer of one who did not perform wudu after eating camel meat",
    },
    {
      url: UTHAYMEEN_WISDOM,
      title: "Ibn Uthaymeen, eating camel meat invalidates wudu, and the wisdom behind it",
    },
    { url: ALBANI, title: "Al-Albani, ruling on wudu after eating camel meat" },
  ],
  sections: [
    {
      heading: "What the Quran says",
      paragraphs: [
        {
          text: "No verse mentions camel meat in connection with wudu. The wudu verse, Al-Ma'idah 5:6, names causes such as relieving oneself and contact with women, and says nothing about food.",
          citations: [QURAN_5_6],
        },
        {
          text: "The Hanafi school states the majority reading as a maxim: nothing of food breaks wudu, which is broken only by what exits and not by what enters.",
          citations: [MUFTIONLINE],
        },
        {
          text: "Hanbalis say the verse is not an exhaustive list, and that the Sunnah can add causes, as it does for touching the private parts and deep sleep.",
          citations: [KASHSHAF],
        },
        {
          text: "The verses on forbidden foods, 2:173, 6:145 and 16:115, do not include camel meat. Both sides agree camel meat is lawful, and the dispute is only about wudu.",
          citations: [QURAN_2_173, QURAN_6_145, QURAN_16_115],
        },
      ],
    },
    {
      heading: "What the hadith show",
      paragraphs: [
        {
          text: "Jabir ibn Samura reported that a man asked whether to perform ablution after mutton, and the Prophet ﷺ said to do so if he wished. Asked about camel's flesh, he said yes, perform ablution.",
          citations: [MUSLIM_360],
        },
        {
          text: "Another report from Jabir says the Prophet ﷺ commanded ablution after eating camel meat but not after mutton. It is graded sahih in the Darussalam edition.",
          citations: [IBN_MAJAH_495],
        },
        {
          text: "Al-Bara ibn Azib said the Prophet ﷺ, asked about camel meat, told them to perform wudu for it, and asked about goat meat, told them not to. It is graded sahih in the Darussalam edition.",
          citations: [TIRMIDHI_81],
        },
        {
          text: "Ahmad is quoted as saying two hadith are authentic on this question, the hadith of al-Bara and the hadith of Jabir ibn Samura.",
          citations: [UTHAYMEEN_EVIDENCE],
        },
        {
          text: "On the other side, Jabir said the last of the two matters from the Prophet ﷺ was leaving off ablution from what fire had touched. Al-Albani graded the Abu Dawud version sahih.",
          citations: [NASAI_185, ABUDAWUD_192],
        },
        {
          text: "Umm Salama brought the Prophet ﷺ a side of roasted meat. He ate from it, stood to pray and did not perform wudu. Al-Tirmidhi called it hasan sahih gharib from this route.",
          citations: [TIRMIDHI_1829],
        },
        {
          text: "Abu Hurairah said the Prophet ﷺ ate meat from a sheep's shoulder, rinsed his mouth, washed his hands and prayed. It is graded sahih in the Darussalam edition.",
          citations: [IBN_MAJAH_493],
        },
      ],
    },
    {
      heading: "How the four schools rule",
      paragraphs: [
        {
          text: "Hanafis say it does not break wudu. Al-Sarakhsi's al-Mabsut says there is no wudu in any food, whether fire touched it or not, and the camel reports are read as washing the mouth and hands.",
          citations: [MUFTIONLINE, DEOBAND, BIRMINGHAM],
        },
        {
          text: "Malikis are reported to hold that it does not break wudu. The sources reached here give this view through Ibn Qudamah and later fatwas, not through a Maliki book.",
          citations: [MUGHNI, DAR_AL_IFTA],
        },
        {
          text: "Shafi'is say it does not break wudu in the newer and more widely held view, while the older view says it does.",
          citations: [JORDAN],
        },
        {
          text: "Hanbalis say it breaks wudu in every case, raw or cooked, knowingly or not. They take the ruling as a matter of obeying the text without a known reason, so it does not reach milk, broth, liver, spleen, hump, skin or stomach.",
          citations: [MUGHNI, KASHSHAF],
        },
        {
          text: "Even inside the Hanbali school the scope is disputed. Ibn Baz held that fat does not break wudu because fat is not meat, while Ibn Uthaymeen extended the ruling to all parts.",
          citations: [IBN_BAZ_FAT, ISLAMQA_PARTS, UTHAYMEEN_ALL],
        },
      ],
    },
    {
      heading: "How scholars reconciled the evidence",
      paragraphs: [
        {
          text: "Dar al-Ifta in Egypt reads the camel meat commands as earlier and abrogated by Jabir's last of the two matters, which removed wudu from anything fire touched.",
          citations: [DAR_AL_IFTA, DAR_AL_IFTA_EN],
        },
        {
          text: "Hanbalis answer that the camel meat command came in the same reply as mutton, which fire also touches, so fire cannot be the issue.",
          citations: [MUGHNI, ISLAMQA_7103],
        },
        {
          text: "Hanbalis also say the camel meat report is specific and the fire report is general, so the specific one carves out an exception. Ibn Uthaymeen and Ibn Baz argue this way.",
          citations: [UTHAYMEEN_ABROGATE, IBN_BAZ_MEAT],
        },
        {
          text: "Hanafis read wudu in the camel reports as washing the mouth and hands, because camel meat is greasy. Hanbalis reply that wudu paired with prayer can only mean the legal wudu.",
          citations: [DEOBAND, ISLAMQA_7103, KASHSHAF],
        },
        {
          text: "Some carried the command as a recommendation for cleanliness, since even eating carrion or pork does not break wudu.",
          citations: [ASKIMAM, ISLAMONLINE_RECOMMENDED],
        },
        {
          text: "Islamweb says that praying behind an imam who holds the other view is valid, according to the majority and Ibn Taymiyyah.",
          citations: [ISLAMWEB_IMAM, ISLAMWEB_IMAM_RENEW],
        },
      ],
    },
    {
      heading: "What recent fatwas say",
      paragraphs: [
        {
          text: "Egypt's Dar al-Ifta, in fatwa 215 of 23 November 2005, says eating camel meat does not invalidate wudu according to the majority of jurists.",
          citations: [DAR_AL_IFTA],
        },
        {
          text: "Dar al-Ifta in Jordan said in 2022 that most Hanafi, Maliki and Shafi'i jurists hold that it does not break wudu.",
          citations: [JORDAN],
        },
        {
          text: "AMJA fatwa 3206 calls it a matter of legitimate ijtihad, says the majority position is non-invalidation, and says performing wudu is the more precautionary course to leave the difference.",
          citations: [AMJA],
        },
        {
          text: 'The Permanent Committee, in fatwa 1257, says wudu is invalidated by the meat, citing "Perform wudu from camel meat", and includes a young camel that has not drunk milk.',
          citations: [COMMITTEE],
        },
        {
          text: "Ibn Baz said the correct view is that eating camel meat invalidates wudu, and that someone who prayed without renewing wudu repeats the prayer.",
          citations: [IBN_BAZ_MEAT, IBN_BAZ_PRAYER],
        },
        {
          text: "Ibn Uthaymeen held that it invalidates wudu, raw or cooked.",
          citations: [UTHAYMEEN_WISDOM, UTHAYMEEN_EVIDENCE],
        },
        {
          text: "Al-Albani held that it invalidates wudu, and that the text binds us even though we do not know its reason.",
          citations: [ALBANI, ISLAMQA_7103],
        },
        {
          text: "Islamweb says the Hanbalis and the verifying Shafi'is hold invalidation, the majority hold non-invalidation, and the invalidation view does not separate raw from cooked meat.",
          citations: [ISLAMWEB_COOKED],
        },
      ],
    },
  ],
  related: ["touching-a-woman-and-wudu", "bleeding-and-wudu"],
} satisfies ArticleInput;
