export type SearchExpectation = {
  label: string
  domains: string[]
}

export type SearchEvaluationCase = {
  id: string
  category: "quran" | "hadith" | "fiqh" | "madhhab" | "guidance" | "counseling" | "finance" | "arabic"
  question: string
  expectations: SearchExpectation[]
}

const expertDomains = [
  "dar-alifta.org",
  "aliftaa.jo",
  "islamqa.info",
  "islamweb.net",
  "seekersguidance.org",
  "islamqa.org",
]

export const searchEvaluationCases: SearchEvaluationCase[] = [
  {
    id: "quran-fasting-verse",
    category: "quran",
    question: "Which Quran verse prescribes fasting in Ramadan?",
    expectations: [{ label: "direct Quran verse", domains: ["quran.com"] }],
  },
  {
    id: "quran-hardship-ease",
    category: "quran",
    question: "What does the Quran say about hardship being followed by ease?",
    expectations: [{ label: "direct Quran verse", domains: ["quran.com"] }],
  },
  {
    id: "hadith-intentions",
    category: "hadith",
    question: "Find the hadith that says actions are judged by intentions.",
    expectations: [{ label: "individual hadith", domains: ["sunnah.com"] }],
  },
  {
    id: "hadith-five-pillars",
    category: "hadith",
    question: "Which authentic hadith lists the five pillars of Islam?",
    expectations: [{ label: "individual hadith", domains: ["sunnah.com"] }],
  },
  {
    id: "fiqh-combining-prayers",
    category: "fiqh",
    question: "When may a traveler combine prayers?",
    expectations: [{ label: "scholarly ruling", domains: expertDomains }],
  },
  {
    id: "fiqh-business-zakat",
    category: "fiqh",
    question: "How is zakat calculated on business inventory?",
    expectations: [{ label: "scholarly ruling", domains: expertDomains }],
  },
  {
    id: "fiqh-mortgage",
    category: "finance",
    question: "What do scholars say about taking a conventional mortgage when renting is difficult?",
    expectations: [{ label: "scholarly ruling", domains: expertDomains }],
  },
  {
    id: "fiqh-missed-fasts",
    category: "fiqh",
    question: "What should someone do about Ramadan fasts missed because of chronic illness?",
    expectations: [
      { label: "direct Quran evidence", domains: ["quran.com"] },
      { label: "scholarly ruling", domains: expertDomains },
    ],
  },
  {
    id: "hanafi-wudu-bleeding",
    category: "madhhab",
    question: "In the Hanafi school, does bleeding invalidate wudu?",
    expectations: [{ label: "Hanafi ruling", domains: ["islamqa.org", "askimam.org", "muftisays.com", "aqfatwa.com", "fatwaqa.com"] }],
  },
  {
    id: "shafii-touch-wudu",
    category: "madhhab",
    question: "In the Shafii school, does touching one's spouse invalidate wudu?",
    expectations: [{ label: "Shafii ruling", domains: ["islamqa.org", "muftiwp.gov.my", "seekersguidance.org"] }],
  },
  {
    id: "maliki-dog-impurity",
    category: "madhhab",
    question: "What is the Maliki position on the purity of a dog's body?",
    expectations: [{ label: "Maliki guidance", domains: ["authenticmaliki.com", "malikifiqhqa.com", "malikischool.org", "imammalikschool.org", "islamqa.org"] }],
  },
  {
    id: "guidance-daily-routine",
    category: "guidance",
    question: "How can a Muslim build a balanced daily routine around prayer, family, and work?",
    expectations: [{ label: "practical guidance", domains: ["productivemuslim.com", "aboutislam.net", "seekersguidance.org"] }],
  },
  {
    id: "guidance-faith-doubts",
    category: "guidance",
    question: "How should a Muslim respond to recurring doubts about faith?",
    expectations: [{ label: "scholarly guidance", domains: ["yaqeeninstitute.org", "seekersguidance.org", "aboutislam.net", "islamqa.info"] }],
  },
  {
    id: "counseling-anxiety",
    category: "counseling",
    question: "I feel overwhelmed by anxiety and guilty that my faith is weak. What should I do?",
    expectations: [{ label: "appropriate counseling", domains: ["aboutislam.net", "yaqeeninstitute.org", "rahmahinstitute.com"] }],
  },
  {
    id: "counseling-marriage-abuse",
    category: "counseling",
    question: "What Islamic guidance is appropriate for someone experiencing emotional abuse in marriage?",
    expectations: [{ label: "appropriate counseling", domains: ["aboutislam.net", "rahmahinstitute.com", "seekersguidance.org"] }],
  },
  {
    id: "arabic-combining-prayers",
    category: "arabic",
    question: "ما حكم الجمع بين الصلاتين للمسافر؟",
    expectations: [{ label: "Arabic scholarly ruling", domains: expertDomains }],
  },
  {
    id: "arabic-whispers",
    category: "arabic",
    question: "كيف يتعامل المسلم مع الوسواس في الطهارة والصلاة؟",
    expectations: [{ label: "Arabic scholarly guidance", domains: expertDomains }],
  },
  {
    id: "finance-debt-repayment",
    category: "finance",
    question: "Should paying a debt take priority over voluntary charity?",
    expectations: [{ label: "scholarly ruling", domains: expertDomains }],
  },
]
