import { describe, expect, test } from "bun:test"

describe("answer citation validation", () => {
  test("rejects citation numbers that do not resolve to gathered evidence", async () => {
    const { validateCitations } = await import("../src/citations")
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
    const { validateCitations } = await import("../src/citations")
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
    const { validateCitations } = await import("../src/citations")
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

  test("removes only an uncited sentence instead of its entire cited bullet", async () => {
    const { stripInvalidCitationPassages, validateCitations } = await import("../src/citations")
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
    const validation = validateCitations(answer, sources)
    const sanitized = stripInvalidCitationPassages(answer, validation)

    expect(sanitized).toBe("-  Actions are judged by intentions.[1]")
    expect(validateCitations(sanitized, sources).valid).toBe(true)
  })
})
