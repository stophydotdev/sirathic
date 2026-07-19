export const QURAN_DOMAIN = "quran.com";

export const HADITH_DOMAIN = "sunnah.com";

export const FIQH_DOMAINS = [
  "islamqa.info",
  "islamweb.net",
  "islamqa.org",
  "seekersguidance.org",
  "yaqeeninstitute.org",
  "daralifta.org",
];

export const buildSiteScope = (domains: string[]) => {
  if (domains.length === 1) return `site:${domains[0]}`;
  return `(${domains.map((d) => `site:${d}`).join(" OR ")})`;
};
