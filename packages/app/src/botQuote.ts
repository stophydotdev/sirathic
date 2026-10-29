export const prependQuote = (quote: string, text: string) =>
  `> ${[...quote]
    .slice(0, 200)
    .join("")
    .replace(/[\r\n]+/gu, " ")}\n\n${text}`;

export const splitQuote = (stored: string) => {
  const match = /^> ([^\r\n]*)\r?\n\r?\n/u.exec(stored);
  return match
    ? { quote: match[1], text: stored.slice(match[0].length) }
    : { quote: undefined, text: stored };
};
