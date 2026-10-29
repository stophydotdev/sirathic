const MASK = "••••••";

const escaped = (text: string) => JSON.stringify(text).slice(1, -1);

const literal = (text: string) => text.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const percentOf = (char: string) =>
  [...new TextEncoder().encode(char)]
    .map((byte) => `%${byte.toString(16).padStart(2, "0")}`)
    .join("");

const charPattern = (char: string) =>
  [
    literal(char),
    percentOf(char),
    percentOf(char).toUpperCase(),
    ...(char === " " ? ["\\+"] : []),
  ].join("|");

const urlPattern = (secret: string) =>
  new RegExp([...secret].map((char) => `(?:${charPattern(char)})`).join(""), "gu");

export const masked = (text: string, secrets: readonly string[]) =>
  [...new Set(secrets)]
    .toSorted((a, b) => b.length - a.length)
    .reduce(
      (out, secret) =>
        out
          .replaceAll(escaped(escaped(secret)), MASK)
          .replaceAll(escaped(secret), MASK)
          .replace(urlPattern(secret), MASK),
      text,
    );
