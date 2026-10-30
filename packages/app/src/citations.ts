const WRAPPED_CITATIONS = /\(\s*((?:\[\d+\]\([^)\s]+\)\s*)+)\)/gu;

export const unwrappedCitations = (text: string) =>
  text.replace(WRAPPED_CITATIONS, (_, run: string) => run.trim());
