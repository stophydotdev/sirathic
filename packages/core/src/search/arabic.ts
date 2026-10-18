const ARABIC_MARKS = /[ـً-ٰٟۖ-ۭ]/gu;

export const arabicTokens = (text: string) =>
  text
    .replace(ARABIC_MARKS, "")
    .replace(/[أإآٱ]/gu, "ا")
    .replace(/ى/gu, "ي")
    .replace(/ة/gu, "ه")
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/u)
    .filter((word) => word.length > 1);

export const arabicWords = (text: string) => new Set(arabicTokens(text));

export const ARABIC_STOPWORDS = arabicWords(
  "من في على عن إلى مع عند حتى بين أن إنما ما لا لم لن قد ثم أو بل إذا إذ يا إلا هو هي هم أنت أنا نحن هذا هذه ذلك تلك الذي التي الذين له لها لهم به بها فيه فيها منه منها عليه عليها عليهم إليه",
);

export const withoutStopwords = (query: string) =>
  query
    .split(/\s+/u)
    .filter((word) => !ARABIC_STOPWORDS.has(arabicTokens(word).join(" ")))
    .join(" ");
