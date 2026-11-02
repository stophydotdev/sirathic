const ISLAMQA_ANSWER = /^islamqa\.info:(?:[a-z]{2}:)?(\d+)/u;

export const answerKey = ({ id, url }: { id: string; url: string }) => {
  const answer = ISLAMQA_ANSWER.exec(id)?.[1];
  return answer ? `islamqa.info:${answer}` : url;
};

export const onePerAnswer = <Row extends { id: string; url: string }>(ranked: Row[]) => {
  const seen = new Set<string>();
  return ranked.filter((row) => {
    const key = answerKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
