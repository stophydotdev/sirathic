import { describe, expect, test } from "bun:test"

describe("answer citation validation", () => {
  test("rejects citation numbers that do not resolve to gathered evidence", async () => {
    const { validateCitations } = await import("../../packages/core/src/citations")
    const sources = [
      {
        index: 1,
        kind: "quran" as const,
        label: "Qur'an 2:255",
        url: "https://quran.com/2/255",
        domain: "quran.com",
        faviconUrl: "https://quran.com/favicon.ico",
        text: "Evidence",
      },
    ]

    expect(validateCitations("Allah is Ever-Living.[2]", sources)).toEqual({
      valid: false,
      invalidIndexes: [2],
      uncitedPassages: [],
    })
  })

  test("rejects substantive uncited passages when evidence was gathered", async () => {
    const { validateCitations } = await import("../../packages/core/src/citations")
    const sources = [
      {
        index: 1,
        kind: "quran" as const,
        label: "Qur'an 2:255",
        url: "https://quran.com/2/255",
        domain: "quran.com",
        faviconUrl: "https://quran.com/favicon.ico",
        text: "Evidence",
      },
    ]
    const uncited = "This verse emphasizes Allah's absolute sovereignty, knowledge, and power."

    expect(validateCitations(`Allah is Ever-Living.[1]\n\n${uncited}`, sources)).toEqual({
      valid: false,
      invalidIndexes: [],
      uncitedPassages: [uncited],
    })
  })

  test("accepts a citation placed after a closing quotation", async () => {
    const { validateCitations } = await import("../../packages/core/src/citations")
    const sources = [
      {
        index: 1,
        kind: "hadith" as const,
        label: "Sahih al-Bukhari 1",
        url: "https://sunnah.com/bukhari:1",
        domain: "sunnah.com",
        faviconUrl: "https://sunnah.com/favicon.ico",
        text: "Actions are judged by intentions.",
      },
    ]

    const answer =
      'The Prophet said: "Actions are judged by intentions. Each person receives what they intended." [1].'
    expect(validateCitations(answer, sources).valid).toBe(true)
  })

  test("accepts a Perplexity-style citation for the complete bullet", async () => {
    const { validateCitations } = await import("../../packages/core/src/citations")
    const sources = [
      {
        index: 1,
        kind: "hadith" as const,
        label: "Sahih al-Bukhari 1",
        url: "https://sunnah.com/bukhari:1",
        domain: "sunnah.com",
        faviconUrl: "https://sunnah.com/favicon.ico",
        text: "Actions are judged by intentions.",
      },
    ]
    const answer = "- Begin with a practical intention. Actions are judged by intentions.[1]"
    expect(validateCitations(answer, sources).valid).toBe(true)
  })

  test("treats a wrapped list item as one citable passage", async () => {
    const { validateCitations } = await import("../../packages/core/src/citations")
    const sources = [
      {
        index: 1,
        kind: "web" as const,
        label: "Prayer guide",
        url: "https://example.com/prayer",
        domain: "example.com",
        faviconUrl: "https://example.com/favicon.ico",
        text: "Prayer steps",
      },
    ]
    const answer = "1. Stand and recite.\n   - Bow, then prostrate.\n   - Complete the prayer with tasleem.[1]"
    expect(validateCitations(answer, sources).valid).toBe(true)
  })

  test("requires direct prose before headings or lists", async () => {
    const { hasPerplexityAnswerShape, normalizePerplexityAnswerShape } = await import("../../packages/core/src/citations")
    expect(hasPerplexityAnswerShape("Prayer begins with intention.[1]\n\n## Steps\n\nThen stand.[1]")).toBe(true)
    expect(hasPerplexityAnswerShape("## Steps\n\nThen stand.[1]")).toBe(false)
    expect(hasPerplexityAnswerShape("1. Stand and recite.[1]")).toBe(false)
    expect(hasPerplexityAnswerShape("Prayer begins with intention.[1]\n\n- **")).toBe(false)
    expect(normalizePerplexityAnswerShape("## Steps\n\n1. **Face the Qiblah**: Stand toward Makkah.[1]")).toBe(
      "Face the Qiblah: Stand toward Makkah.[1]",
    )
    expect(normalizePerplexityAnswerShape("1. **First**: Begin.[1]\n\n2. **Second**: Continue.[1]")).toBe(
      "First: Begin.[1]\n\nSecond: Continue.[1]",
    )
  })

  test("does not require citations on headings and removes empty sections", async () => {
    const { stripInvalidCitationPassages, validateCitations } = await import("../../packages/core/src/citations")
    const sources = [
      {
        index: 1,
        kind: "hadith" as const,
        label: "Sahih al-Bukhari 1",
        url: "https://sunnah.com/bukhari:1",
        domain: "sunnah.com",
        faviconUrl: "https://sunnah.com/favicon.ico",
        text: "Actions are judged by intentions.",
      },
    ]
    const answer = "## Direct answer\n\nActions are judged by intentions.[1]\n\n## Empty section\n\n**Also empty:**"
    const validation = validateCitations(answer, sources)
    const sanitized = stripInvalidCitationPassages(answer, validation)

    expect(validation.valid).toBe(true)
    expect(sanitized).toBe("## Direct answer\n\nActions are judged by intentions.[1]")
  })
})
