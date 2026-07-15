import { describe, expect, test } from "bun:test"

process.env.DATABASE_URL ||= "postgres://unused"
process.env.OPENAI_API_KEY ||= "test-key"

const { createApp } = await import("./app")

describe("research interface", () => {
  test("serves the Sirathic research workspace", async () => {
    const response = await createApp().request("/")
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/html")
    expect(html).toContain("Ask Sirathic")
    expect(html).toContain("Research depth")
    expect(html).toContain("Source families")
  })
})

describe("POST /v1/ask", () => {
  test("returns an answer produced by the research-tool service", async () => {
    const app = createApp({
      ask: async (question) => ({
        answer: `Grounded answer for: ${question}`,
        research: { generatedQueries: [question], queries: [`${question} site:quran.com`], sources: [] },
        sources: [
          {
            index: 1,
            kind: "quran",
            label: "Qur'an 2:255",
            url: "https://quran.com/2/255",
            domain: "quran.com",
            faviconUrl: "https://quran.com/favicon.ico",
            text: "Ayat al-Kursi",
          },
        ],
      }),
    })

    const response = await app.request("/v1/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "What is Ayat al-Kursi?" }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      answer: "Grounded answer for: What is Ayat al-Kursi?",
      research: {
        generatedQueries: ["What is Ayat al-Kursi?"],
        queries: ["What is Ayat al-Kursi? site:quran.com"],
        sources: [],
      },
      sources: [
        {
          index: 1,
          kind: "quran",
          label: "Qur'an 2:255",
          url: "https://quran.com/2/255",
          domain: "quran.com",
          faviconUrl: "https://quran.com/favicon.ico",
          text: "Ayat al-Kursi",
        },
      ],
    })
  })

  test("streams typed research, source, answer, and completion events", async () => {
    const app = createApp({
      askEvents: async (_question, _options, emit) => {
        const sources = [
          {
            index: 1,
            kind: "quran" as const,
            label: "Qur'an 2:255",
            url: "https://quran.com/2/255",
            domain: "quran.com",
            faviconUrl: "https://quran.com/favicon.ico",
            text: "Ayat al-Kursi",
          },
        ]
        await emit({ type: "research-start", mode: "balanced" })
        const research = {
          generatedQueries: ["Ayat al-Kursi meaning"],
          queries: ["Ayat al-Kursi meaning site:quran.com"],
          sources: [],
        }
        await emit({ type: "search-results", ...research })
        await emit({ type: "tool-complete", tools: ["searchSources"], found: 3 })
        await emit({ type: "sources", sources })
        await emit({ type: "answer-delta", delta: "Allah is Ever-Living.[1]" })
        const result = { answer: "Allah is Ever-Living.[1]", sources, research }
        await emit({ type: "done", ...result })
        return result
      },
    })

    const response = await app.request("/v1/ask", {
      method: "POST",
      headers: { accept: "text/event-stream", "content-type": "application/json" },
      body: JSON.stringify({ question: "What does Ayat al-Kursi teach?", stream: true, mode: "balanced" }),
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/event-stream")
    expect(body).toContain("event: research-start")
    expect(body).toContain("event: search-results")
    expect(body).toContain("event: tool-complete")
    expect(body).toContain("event: sources")
    expect(body).toContain("event: answer-delta")
    expect(body).toContain("event: done")
  })
})
