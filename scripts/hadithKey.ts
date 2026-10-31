export const hadithKey = (text: string) =>
  text
    .replace(/[ً-ٰٟـ]/gu, "")
    .replace(/[أإآٱ]/gu, "ا")
    .replace(/ى/gu, "ي")
    .replace(/ة/gu, "ه")
    .replace(/[^ء-ي\s]/gu, " ")
    .replace(/صلي الله عليه (واله )?وسلم/gu, " ")
    .replace(/(^|\s)ابن(?=\s|$)/gu, "$1بن")
    .replace(/\s+/gu, "");
