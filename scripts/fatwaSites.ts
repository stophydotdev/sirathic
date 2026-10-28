import { FATWA_MIRRORS } from "./catalog";
import {
  ANSWER_MARK,
  amjaFatwas,
  articleSite,
  between,
  by,
  darulIftaaFatwas,
  decode,
  fatwaIslamFatwas,
  headingLine,
  ISLAMQA_ANSWER,
  mappedUrls,
  pageTitle,
  plainText,
  publishedOf,
  schoolOf,
  type Site,
  VERSION,
} from "./fatwaPages";

export const SITES: Site[] = [
  {
    source: {
      name: "islamqa.info",
      url: "https://islamqa.info",
      version: VERSION,
      license:
        "Not reviewed. islamqa.info/en/terms permits personal use; confirm reuse terms before launch",
      credit: "Islam Question & Answer (islamqa.info)",
    },
    sitemaps: ["https://islamqa.info/sitemaps/sitemap-index.xml"],
    page: ISLAMQA_ANSWER,
    parallel: 32,
    parse: (markdown, html, url) => {
      const [, lang, number] = ISLAMQA_ANSWER.exec(url) ?? [];
      const title = pageTitle(markdown, html);
      const answerLabel = /<h2[^>]*>([^<]+)<hr/u.exec(html)?.[1];
      const summaryLabel = /<h2 class="[^"]*tw-text-secondary[^"]*">([^<]+)<\/h2>/u.exec(html)?.[1];
      const sourceLabel = /<h2>([^<]+?)(?:<!-- -->)?:\s*<\/h2><p data-sut="fatwa-source"/u.exec(
        html,
      )?.[1];
      const answer = between(markdown, headingLine(answerLabel), headingLine(sourceLabel, ":"));
      if (!title || !answer || !number) return undefined;
      return {
        id: lang === "en" ? `islamqa.info:${number}` : `islamqa.info:${lang}:${number}`,
        school: "hanbali",
        answeredBy: "IslamQA",
        title,
        question: between(markdown, new RegExp(`^## .+ ${number}\\s*$`, "mu"), /^## /mu),
        summary: between(markdown, headingLine(summaryLabel), /^(Similar Topics|## )/mu),
        answer,
        publishedAt: publishedOf(html),
      };
    },
  },
  {
    source: {
      name: "islamweb.net",
      url: "https://www.islamweb.net/en/fatawa/",
      version: VERSION,
      license: "Not reviewed. Confirm reuse terms before launch",
      credit: "Islamweb Fatwa Center (Qatar Ministry of Awqaf)",
    },
    sitemaps: [],
    listings: {
      start: ["https://www.islamweb.net/en/fatawa/"],
      follow: /^https:\/\/www\.islamweb\.net\/en\/fatawa\/\d+\/[^?]*(\?pageno=\d+&tab=1)?$/u,
    },
    page: /^https:\/\/www\.islamweb\.net\/(ar|en)\/fatwa\/\d+\//u,
    parallel: 8,
    parse: (markdown, html, url) => {
      const [, lang, number] = /\/(ar|en)\/fatwa\/(\d+)\//u.exec(url) ?? [];
      const title = /<h2[^>]*>([\s\S]*?)<\/h2>/u
        .exec(html)?.[1]
        ?.replaceAll(/<[^>]+>/gu, "")
        .trim();
      const [asked, answered] = [...markdown.matchAll(/^### .+$/gmu)];
      const [question, answer = ""] =
        asked && answered
          ? [
              markdown.slice(asked.index + asked[0].length, answered.index),
              markdown.slice(answered.index + answered[0].length),
            ].map((part) => part.trim())
          : [...html.matchAll(/<div itemprop="text">([\s\S]*?)<\/div>/gu)].map(([, part = ""]) =>
              plainText(part),
            );
      if (!title || answer.length < 100) return undefined;
      return {
        id: `islamweb.net:${lang}:${number}`,
        answeredBy: "Islamweb Fatwa Center",
        title: decode(title),
        question: question || undefined,
        answer,
      };
    },
  },
  {
    source: {
      name: "islamqa.org",
      url: "https://islamqa.org",
      version: VERSION,
      license:
        "Not reviewed. Answers are collected from each darul iftaa's own site; confirm reuse terms before launch",
      credit: "IslamQA.org and the darul iftaas it collects from",
    },
    sitemaps: ["https://islamqa.org/sitemap.xml"],
    page: /^https:\/\/islamqa\.org\/(hanafi|shafii|maliki|hanbali)\/[^/]+\/\d+\//u,
    skip: new RegExp(
      `^https://islamqa\\.org/[^/]+/(${Object.keys(FATWA_MIRRORS).join("|")})/`,
      "u",
    ),
    parallel: 32,
    parse: (markdown, html, url) => {
      const title = pageTitle(markdown, html);
      const scholar = /Answered by\s*\n+\s*(.+)/u.exec(markdown)?.[1]?.trim();
      const from = /<meta[^>]+property="article:section"[^>]+content="([^"]+)"/u.exec(html)?.[1];
      const body = between(
        markdown,
        /^From\b.*$/mu,
        /^(\**Original Source Link\**|This answer was collected|Tags:)/mu,
      )
        ?.replace(/^Answered by\s*\n+\s*.+\n*/u, "")
        .trim();
      if (!title || !body) return undefined;
      const split = /^#+\s*\**Answer:?\**\s*$/mu.exec(body);
      return {
        id: `islamqa.org:${/^https:\/\/islamqa\.org\/[^/]+\/[^/]+\/(\d+)\//u.exec(url)?.[1]}`,
        school: schoolOf(url),
        answeredBy: [scholar, from].filter(Boolean).join(", ") || undefined,
        title,
        question: split
          ? body
              .slice(0, split.index)
              .replace(/^#+\s*\**Question:?\**\s*$/mu, "")
              .trim() || undefined
          : undefined,
        answer: split ? body.slice(split.index + split[0].length).trim() : body,
        publishedAt: publishedOf(html),
      };
    },
  },
  articleSite({
    name: "seekersguidance.org",
    url: "https://seekersguidance.org/answers/",
    credit: "SeekersGuidance",
    sitemaps: ["https://seekersguidance.org/sitemap_index.xml"],
    follow: /^post-sitemap\d*\.xml$/u,
    page: /^https:\/\/seekersguidance\.org\/answers\//u,
    parallel: 1,
    delayMs: 10_000,
    answeredBy: (markdown) =>
      (/^Answered by (.+)$/mu.exec(markdown) ??
        /^## (.+?) (?:is asked|addresses|answers|explains|discusses|clarifies|advises|responds)\b/mu.exec(
          markdown,
        ) ??
        /^\[[A-Z][a-z]+ \d{1,2}, \d{4}\] \[([^\]]+)\]/mu.exec(markdown))?.[1]?.trim(),
  }),
  articleSite({
    name: "iifa-aifi.org",
    url: "https://iifa-aifi.org/ar",
    credit: "International Islamic Fiqh Academy (OIC)",
    sitemaps: ["https://iifa-aifi.org/ar/wp-sitemap.xml"],
    page: /^https:\/\/iifa-aifi\.org\/ar\/\d+\.html$/u,
    answeredBy: by("International Islamic Fiqh Academy"),
  }),
  articleSite({
    name: "albalagh.net",
    url: "https://albalagh.net",
    credit: "Albalagh (Mufti Taqi Usmani, Khalid Baig)",
    sitemaps: ["https://albalagh.net/sitemap_index.xml"],
    page: /^https:\/\/(www\.)?albalagh\.net\/[a-z_-]+\/[^/]+/u,
    school: "hanafi",
  }),
  articleSite({
    name: "mathabah.org",
    url: "https://mathabah.org",
    credit: "Mathabah (Mufti Abdur-Rahman ibn Yusuf Mangera)",
    sitemaps: ["https://mathabah.org/sitemap_index.xml"],
    page: /^https:\/\/(www\.)?mathabah\.org\/[^/]+\/?$/u,
    school: "hanafi",
  }),
  articleSite({
    name: "akramnadwi.com",
    url: "https://akramnadwi.com",
    credit: "Shaykh Mohammad Akram Nadwi",
    sitemaps: ["https://akramnadwi.com/wp-sitemap.xml"],
    follow: /posts-(post|qa)/u,
    page: /^https:\/\/(www\.)?akramnadwi\.com\/.+/u,
    answeredBy: by("Shaykh Mohammad Akram Nadwi"),
  }),
  articleSite({
    name: "drhatemalhaj.com",
    url: "https://www.drhatemalhaj.com",
    credit: "Dr. Hatem al-Haj",
    sitemaps: ["https://www.drhatemalhaj.com/wp-sitemap.xml"],
    follow: /posts-post/u,
    page: /^https:\/\/www\.drhatemalhaj\.com\/.+/u,
    school: "hanbali",
    answeredBy: by("Dr. Hatem al-Haj"),
  }),
  articleSite({
    name: "basiraeducation.org",
    url: "https://www.basiraeducation.org/blog",
    credit: "Basira Education (Shaykh Hamza Karamali)",
    sitemaps: ["https://www.basiraeducation.org/sitemap.xml"],
    page: /^https:\/\/www\.basiraeducation\.org\/blog\/.+/u,
    school: "shafii",
  }),
  articleSite({
    name: "amjaonline.org",
    url: "https://www.amjaonline.org",
    credit: "Assembly of Muslim Jurists of America",
    sitemaps: ["https://www.amjaonline.org/post-sitemap.xml"],
    discover: async () => [...(await amjaFatwas("en")), ...(await amjaFatwas("ar"))],
    page: /^https:\/\/www\.amjaonline\.org\/.+/u,
    answeredBy: by("Assembly of Muslim Jurists of America"),
  }),
  articleSite({
    name: "diftalon.com",
    url: "https://www.diftalon.com",
    credit: "Darul Ifta London",
    sitemaps: ["https://www.diftalon.com/post-sitemap.xml"],
    page: /^https:\/\/www\.diftalon\.com\/[^/]+\/?$/u,
    school: "hanafi",
    answeredBy: by("Darul Ifta London"),
  }),
  articleSite({
    name: "fiqhcouncil.org",
    url: "https://fiqhcouncil.org",
    credit: "Fiqh Council of North America",
    sitemaps: ["https://fiqhcouncil.org/post-sitemap.xml"],
    page: /^https:\/\/fiqhcouncil\.org\/.+/u,
    answeredBy: by("Fiqh Council of North America"),
  }),
  articleSite({
    name: "yaqeeninstitute.org",
    url: "https://yaqeeninstitute.org/read",
    credit: "Yaqeen Institute for Islamic Research",
    sitemaps: [
      "https://yaqeeninstitute.org/post-sitemap1.xml",
      "https://yaqeeninstitute.org/post-sitemap2.xml",
    ],
    page: /^https:\/\/yaqeeninstitute\.org\/read\/.+/u,
    parallel: 4,
  }),
  articleSite({
    name: "islamonline.net",
    url: "https://islamonline.net",
    credit: "IslamOnline",
    sitemaps: ["https://islamonline.net/sitemap_index.xml"],
    follow: /^post-sitemap\d*\.xml$/u,
    page: /^https:\/\/islamonline\.net\/(?!fr\/).+/u,
    parallel: 4,
  }),
  articleSite({
    name: "qalaminstitute.org",
    url: "https://www.qalaminstitute.org",
    credit: "Qalam Institute",
    sitemaps: ["https://qalaminstitute.org/sitemap_index.xml"],
    follow: /^post-sitemap\d*\.xml$/u,
    page: /^https:\/\/(www\.)?qalaminstitute\.org\/\d{4}\/.+/u,
  }),
  articleSite({
    name: "almadina.org",
    url: "https://www.almadina.org/studio/articles",
    credit: "Al-Madina Institute",
    sitemaps: ["https://www.almadina.org/sitemap.xml"],
    page: /^https:\/\/www\.almadina\.org\/studio\/articles\/.+/u,
  }),
  articleSite({
    name: "muslimheritage.com",
    url: "https://muslimheritage.com",
    credit: "Muslim Heritage (FSTC)",
    sitemaps: ["https://muslimheritage.com/sitemap_index.xml"],
    follow: /^post-sitemap\d*\.xml$/u,
    page: /^https:\/\/muslimheritage\.com\/[^/]+\/?$/u,
  }),
  articleSite({
    name: "thehumblei.com",
    url: "https://thehumblei.com",
    credit: "The Humble I (Abu Aaliyah Surkheel Sharif)",
    sitemaps: ["https://thehumblei.com/sitemap.xml"],
    page: /^https:\/\/thehumblei\.com\/\d{4}\/\d{2}\/\d{2}\/.+/u,
    answeredBy: by("Abu Aaliyah Surkheel Sharif"),
  }),
  articleSite({
    name: "renovatio.zaytuna.edu",
    url: "https://renovatio.zaytuna.edu",
    credit: "Renovatio, Zaytuna College",
    sitemaps: ["https://renovatio.zaytuna.edu/sitemap.xml"],
    page: /^https:\/\/renovatio\.zaytuna\.edu\/article\/.+/u,
  }),
  articleSite({
    name: "sapienceinstitute.org",
    url: "https://www.sapienceinstitute.org",
    credit: "Sapience Institute",
    sitemaps: ["https://www.sapienceinstitute.org/wp-sitemap.xml"],
    follow: /posts-post/u,
    page: /^https:\/\/www\.sapienceinstitute\.org\/[^/]+\/?$/u,
  }),
  articleSite({
    name: "sandala.org",
    url: "https://sandala.org/blogs",
    credit: "Sandala (Shaykh Hamza Yusuf)",
    sitemaps: ["https://sandala.org/sitemap.xml"],
    follow: /^sitemap_(blogs|articles)/u,
    page: /^https:\/\/sandala\.org\/blogs\/[^/]+\/.+/u,
  }),
  articleSite({
    name: "islamicorigins.com",
    url: "https://islamicorigins.com",
    credit: "Islamic Origins (Dr. Joshua Little)",
    sitemaps: ["https://islamicorigins.com/post-sitemap.xml"],
    page: /^https:\/\/islamicorigins\.com\/.+/u,
  }),
  articleSite({
    name: "islamicfinanceguru.com",
    url: "https://www.islamicfinanceguru.com",
    credit: "Islamic Finance Guru",
    sitemaps: ["https://www.islamicfinanceguru.com/sitemap.xml"],
    page: /^https:\/\/www\.islamicfinanceguru\.com\/(articles|dictionary|guides-and-faqs|goal-based-guides)\/.+/u,
  }),
  articleSite({
    name: "blog.zoya.finance",
    url: "https://blog.zoya.finance",
    credit: "Zoya",
    sitemaps: ["https://blog.zoya.finance/sitemap.xml"],
    page: /^https:\/\/blog\.zoya\.finance\/(?!(fr|de|ar|tr|id|es)\/).+/u,
  }),
  articleSite({
    name: "herislamicfinance.com",
    url: "https://herislamicfinance.com/blog",
    credit: "Her Islamic Finance",
    sitemaps: ["https://herislamicfinance.com/sitemap-index.xml"],
    page: /^https:\/\/herislamicfinance\.com\/blog\/.+/u,
  }),
  articleSite({
    name: "muslimmatters.org",
    url: "https://muslimmatters.org",
    credit: "MuslimMatters (community blog)",
    sitemaps: ["https://muslimmatters.org/sitemap_index.xml"],
    follow: /^post-sitemap\d*\.xml$/u,
    page: /^https:\/\/muslimmatters\.org\/\d{4}\/.+/u,
    parallel: 4,
  }),
  articleSite({
    name: "virtualmosque.com",
    url: "https://www.virtualmosque.com",
    credit: "Virtual Mosque (community blog)",
    sitemaps: ["https://www.virtualmosque.com/wp-sitemap.xml"],
    follow: /posts-post/u,
    page: /^https:\/\/www\.virtualmosque\.com\/.+/u,
  }),
  articleSite({
    name: "aboutislam.net",
    url: "https://aboutislam.net",
    credit: "AboutIslam",
    sitemaps: ["https://aboutislam.net/sitemap_index.xml"],
    follow: /^(post|counseling|live_session)-sitemap\d*\.xml$/u,
    page: /^https:\/\/aboutislam\.net\/(counseling|live-session|reading-islam|family-life|shariah|spirituality|muslim-issues|science|blog)\/.+/u,
    parallel: 4,
  }),
  articleSite({
    name: "dar-alifta.org",
    url: "https://www.dar-alifta.org",
    credit: "Dar al-Ifta al-Misriyyah",
    sitemaps: [
      "https://www.dar-alifta.org/en/sitemap.xml",
      "https://www.dar-alifta.org/ar/sitemap.xml",
    ],
    page: /^https:\/\/www\.dar-alifta\.org\/(en|ar)\/fatwa\/details\/\d+/iu,
    answerMark: new RegExp(`${ANSWER_MARK.source}|^#+ Answer\\s*$`, "mu"),
    end: /^اقرأ أيضا ?:\s*$/mu,
    parallel: 4,
    answeredBy: by("Dar al-Ifta al-Misriyyah"),
  }),
  articleSite({
    name: "en.tohed.com",
    url: "https://en.tohed.com",
    credit: "Tohed",
    sitemaps: ["https://en.tohed.com/sitemap.php"],
    page: /^https:\/\/en\.tohed\.com\/threads\/.+/u,
    answeredBy: by("Tohed"),
  }),
  articleSite({
    name: "fiqh.islamonline.net",
    url: "https://fiqh.islamonline.net",
    credit: "IslamOnline Fiqh",
    sitemaps: [],
    discover: () => mappedUrls("https://fiqh.islamonline.net"),
    page: /^https:\/\/fiqh\.islamonline\.net\/.+/u,
    parallel: 4,
    delayMs: 500,
    answeredBy: by("IslamOnline"),
  }),
  articleSite({
    name: "al-fatawa.com",
    url: "https://al-fatawa.com/en",
    credit:
      "Al-Fatawa (Ibn Baz, Ibn Uthaymeen, al-Albani, al-Fawzan, the Permanent Committee). English is machine translation",
    sitemaps: ["https://al-fatawa.com/sitemap.xml"],
    follow: /^sitemap-en-(?!pages)/u,
    page: /^https:\/\/al-fatawa\.com\/en\/fatwa\/\d+\/.+/u,
    answerMark: new RegExp(`${ANSWER_MARK.source}|^The Shaykh\\s*:`, "mu"),
    parallel: 4,
  }),
  articleSite({
    name: "daruliftaa.us",
    url: "https://daruliftaa.us",
    credit: "Darul Iftaa Chicago",
    sitemaps: [],
    discover: darulIftaaFatwas,
    page: /^https:\/\/daruliftaa\.us\/fatwa\/\d+\/$/u,
    answerMark: /^#+ \**الجواب.*$/mu,
    school: "hanafi",
    answeredBy: by("Darul Iftaa Chicago"),
  }),
  {
    ...articleSite({
      name: "fatwaislam.com",
      url: "https://fatwaislam.com/fis/",
      credit: "FatwaIslam",
      sitemaps: [],
      discover: fatwaIslamFatwas,
      page: /^https:\/\/fatwaislam\.com\/fis\/index\.cfm\?scn=fd&ID=\d+$/u,
      skip: /$^/u,
      parallel: 1,
      delayMs: 30_000,
    }),
    parse: (_markdown, html, url) => {
      const grab = (pattern: RegExp) => pattern.exec(html)?.[1] ?? "";
      const title = plainText(grab(/<font style="font-size:13px;">\s*<b>([\s\S]*?)<\/b>/u));
      const question = plainText(grab(/<u>Question:<\/u>([\s\S]*?)<\/td>/u));
      const answer = plainText(grab(/<u>Answer:<\/u>([\s\S]*?)<\/td>/u));
      const credit = grab(/<u>Answer:<\/u>[\s\S]*?<\/td>([\s\S]*?)<b>Other subjects of interest/u);
      return title && question && answer
        ? {
            id: `fatwaislam.com:${new URL(url).searchParams.get("ID")}`,
            answeredBy: plainText(/<b>([\s\S]*?)<\/b>/u.exec(credit)?.[1] ?? "") || undefined,
            title,
            question,
            answer: [answer, plainText(credit)].filter(Boolean).join("\n\n"),
          }
        : undefined;
    },
  },
  articleSite({
    name: "muftiwp.gov.my",
    url: "https://muftiwp.gov.my/en/artikel",
    credit: "Federal Territory Mufti Office, Malaysia",
    sitemaps: [],
    listings: {
      start: [
        "https://muftiwp.gov.my/en/artikel/irsyad-al-hadith",
        "https://muftiwp.gov.my/en/artikel/irsyad-usul-fiqh",
        "https://muftiwp.gov.my/en/artikel/bayan-li-al-haj",
      ],
      follow:
        /^https:\/\/muftiwp\.gov\.my\/en\/artikel\/(?:irsyad-al-hadith|irsyad-usul-fiqh|bayan-li-al-haj)\?start=\d+$/u,
    },
    page: /^https:\/\/muftiwp\.gov\.my\/en\/artikel\/(?:irsyad-al-hadith|irsyad-usul-fiqh|bayan-li-al-haj)\/\d+-[^/?#]*-series-[^/?#]*$/u,
    headline: /<h2 itemprop="headline"[^>]*>([^<]+)/u,
    parallel: 1,
    delayMs: 1_000,
    school: "shafii",
    answeredBy: by("Federal Territory Mufti Office"),
  }),
  articleSite({
    name: "britishfatwacouncil.org",
    url: "https://www.britishfatwacouncil.org",
    credit: "British Fatwa Council",
    sitemaps: ["https://www.britishfatwacouncil.org/post-sitemap.xml"],
    page: /^https:\/\/www\.britishfatwacouncil\.org\/.+/u,
    answeredBy: by("British Fatwa Council"),
  }),
];
