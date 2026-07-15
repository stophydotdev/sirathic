import type { CitationValidation, Source } from "./types"

function splitCitablePassages(answer: string): string[] {
  return answer
    .split(/\n{2,}/u)
    .map((block) => block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !isStructuralMarkdown(line))
      .join("\n"))
    .filter(Boolean)
}

function isStructuralMarkdown(value: string): boolean {
  return /^#{1,6}\s+\S/u.test(value) || /^\*{1,2}[^*]+\*{1,2}:?$/u.test(value) || /^\*{1,2}$/u.test(value)
}

function removeTrailingEmptySections(answer: string): string {
  const blocks = answer.split(/\n{2,}/u).map((block) => block.trim()).filter(Boolean)
  while (blocks.length > 0 && blocks.at(-1)?.split("\n").every((line) => isStructuralMarkdown(line.trim()))) {
    blocks.pop()
  }
  return blocks.join("\n\n")
}

function normalizeCitablePassage(passage: string): string {
  return passage.trim().replace(/^[-*#>\d.)\s]+/, "")
}

export function validateCitations(answer: string, sources: Source[]): CitationValidation {
  const invalidIndexes = [
    ...new Set(
      [...answer.matchAll(/\[(\d+)\]/g)]
        .map((match) => Number(match[1]))
        .filter((index) => index < 1 || index > sources.length),
    ),
  ]

  const uncitedPassages =
    sources.length === 0
      ? []
      : splitCitablePassages(answer)
          .map(normalizeCitablePassage)
          .filter((passage) => passage.length >= 32 && /\p{L}/u.test(passage) && !/\[\d+\]/.test(passage))

  return {
    valid: invalidIndexes.length === 0 && uncitedPassages.length === 0,
    invalidIndexes,
    uncitedPassages,
  }
}

export function hasPerplexityAnswerShape(answer: string): boolean {
  const lines = answer.split("\n").map((line) => line.trim()).filter(Boolean)
  const first = lines[0] ?? ""
  if (!first || /^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|\*{1,2}[^*]+\*{1,2}:?)/u.test(first)) return false

  return !lines.some((line) =>
    /^[-*+]\s*\*{0,2}\s*$/u.test(line)
    || /^\d+[.)]\s*\*{0,2}\s*$/u.test(line)
    || (/\*\*/u.test(line) && (line.match(/\*\*/gu)?.length ?? 0) % 2 !== 0),
  )
}

export function normalizePerplexityAnswerShape(answer: string): string {
  const blocks = answer.split(/\n{2,}/u).map((block) => block.trim()).filter(Boolean)
  while (blocks.length > 1 && blocks[0]?.split("\n").every((line) => isStructuralMarkdown(line.trim()))) blocks.shift()
  if (blocks.length === 0) return ""

  const firstLine = (blocks[0] ?? "").split("\n")[0] ?? ""
  const startedAsList = /^\s*(?:[-*+]\s+|\d+[.)]\s+)/u.test(firstLine)
  const indexes = startedAsList ? blocks.keys() : [0].values()
  for (const index of indexes) {
    const lines = (blocks[index] ?? "").split("\n")
    lines[0] = (lines[0] ?? "")
      .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/u, "")
      .replace(/^\*{1,2}([^*]+)\*{1,2}:?/u, "$1:")
    blocks[index] = lines.join("\n")
  }
  return blocks.join("\n\n")
}

export function stripInvalidCitationPassages(answer: string, validation: CitationValidation): string {
  const uncited = new Set(validation.uncitedPassages)
  const invalidMarkers = validation.invalidIndexes.map((index) => `[${index}]`)
  const sanitized = answer
    .split(/\n{2,}/u)
    .filter((block) => !invalidMarkers.some((marker) => block.includes(marker)))
    .filter((block) => !splitCitablePassages(block).some((passage) => uncited.has(normalizeCitablePassage(passage))))
    .join("\n\n")
    .replace(/^\s*[-*]\s*$/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return removeTrailingEmptySections(sanitized)
}
