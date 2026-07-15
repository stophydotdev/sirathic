import type { CitationValidation, Source } from "./types"

function splitCitablePassages(answer: string): string[] {
  const passages: string[] = []
  let current = ""
  let inDoubleQuote = false

  const flush = () => {
    if (current.trim()) passages.push(current.trim())
    current = ""
  }

  for (let index = 0; index < answer.length; index++) {
    const character = answer[index] ?? ""
    current += character

    if (character === '"') inDoubleQuote = !inDoubleQuote
    else if (character === "“") inDoubleQuote = true
    else if (character === "”") inDoubleQuote = false

    if (character === "\n") {
      flush()
      continue
    }
    if (inDoubleQuote || !/[.!?؟]/u.test(character)) continue

    const remainder = answer.slice(index + 1)
    const whitespace = remainder.match(/^\s+/u)?.[0]
    if (!whitespace) continue
    const next = remainder.slice(whitespace.length)
    if (next.startsWith("[")) continue

    index += whitespace.length
    flush()
  }

  flush()
  return passages
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
          .map((passage) => passage.trim().replace(/^[-*#>\d.)\s]+/, ""))
          .filter((passage) => passage.length >= 32 && /\p{L}/u.test(passage) && !/\[\d+\]/.test(passage))

  return {
    valid: invalidIndexes.length === 0 && uncitedPassages.length === 0,
    invalidIndexes,
    uncitedPassages,
  }
}

export function stripInvalidCitationPassages(answer: string, validation: CitationValidation): string {
  let sanitized = answer
  for (const passage of validation.uncitedPassages) sanitized = sanitized.replace(passage, "")

  const invalidMarkers = validation.invalidIndexes.map((index) => `[${index}]`)
  sanitized = sanitized
    .split("\n")
    .filter((line) => !invalidMarkers.some((marker) => line.includes(marker)))
    .join("\n")
    .replace(/^\s*[-*]\s*$/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return sanitized
}
