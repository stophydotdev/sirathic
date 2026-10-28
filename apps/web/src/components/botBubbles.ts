const STRUCTURED = /^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|\|)/u;

export const bubblesOf = (text: string) => {
  const bubbles: string[] = [];
  for (const block of text.split(/\n\s*\n/u)) {
    const last = bubbles.at(-1);
    const insideFence = (last?.match(/```/gu)?.length ?? 0) % 2 === 1;
    if (last && (insideFence || STRUCTURED.test(block))) {
      bubbles[bubbles.length - 1] = `${last}\n\n${block}`;
    } else if (block.trim()) bubbles.push(block);
  }
  return bubbles;
};
