const ISLAMQA_ANSWER = /^islamqa\.info:(?:[a-z]{2}:)?(\d+)/u;

export const onePerAnswer = <Row extends { id: string; url: string }>(ranked: Row[]) => {
  const seen = new Set<string>();
  return ranked.filter((row) => {
    const answer = ISLAMQA_ANSWER.exec(row.id)?.[1];
    const key = answer ? `islamqa.info:${answer}` : row.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
