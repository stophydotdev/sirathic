import { describe, expect, test } from "bun:test"

process.env.DATABASE_URL ||= "postgres://unused"
process.env.OPENAI_API_KEY ||= "test-key"

describe("Islamic research tool selection", () => {
  test("uses direct HTML as clean evidence without launching a browser", async () => {
    const { fetchDirect } = await import("../src/tools/webFetch/direct")
    const article = `<html lang="en"><head><title>Direct evidence</title></head><body><nav>Noise</nav><main><h1>Keeping promises</h1><p>${"A trustworthy person keeps promises and deals honestly with other people. ".repeat(6)}</p></main><script>noise()</script></body></html>`
    const result = await fetchDirect(
      { url: "https://example.com/evidence" },
      async () => new Response(article, { status: 200, headers: { "content-type": "text/html" } }),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.via).toBe("direct")
    expect(result.title).toBe("Direct evidence")
    expect(result.markdown).toContain("Keeping promises")
    expect(result.markdown).not.toContain("Noise")
    expect(result.markdown).not.toContain("noise()")
  })

  test("escalates only retryable Crawl4AI failures", async () => {
    const { shouldEscalate } = await import("../src/tools/webFetch")
    const failure = (reason: "http-error" | "no-markdown" | "timeout" | "transport", status?: number) => ({
      ok: false as const,
      url: "https://example.com",
      reason,
      status,
    })

    expect(shouldEscalate(failure("transport"))).toBe(true)
    expect(shouldEscalate(failure("no-markdown"))).toBe(true)
    expect(shouldEscalate(failure("http-error", 403))).toBe(true)
    expect(shouldEscalate(failure("http-error", 429))).toBe(true)
    expect(shouldEscalate(failure("http-error", 503))).toBe(true)
    expect(shouldEscalate(failure("http-error", 404))).toBe(false)
  })

  test("uses long evidence TTLs and short time-sensitive search TTLs", async () => {
    const { fetchCacheTtl } = await import("../src/tools/webFetch")
    const { searchCacheTtl } = await import("../src/tools/webSearch")

    expect(fetchCacheTtl("https://quran.com/2/183")).toBe(30 * 24 * 60 * 60)
    expect(fetchCacheTtl("https://sunnah.com/bukhari:1")).toBe(30 * 24 * 60 * 60)
    expect(fetchCacheTtl("https://islamqa.info/en/answers/1/example")).toBe(7 * 24 * 60 * 60)
    expect(searchCacheTtl("how to become a better Muslim")).toBe(6 * 60 * 60)
    expect(searchCacheTtl("latest moon sighting news today")).toBe(10 * 60)
  })

  test("exposes only the two batched research tools", async () => {
    const { buildTools } = await import("../src/tools")
    expect(Object.keys(buildTools())).toEqual(["searchSources", "fetchSources"])
    expect(Object.keys(buildTools({ sources: ["hadith"] }))).toEqual(["searchSources", "fetchSources"])
  })

  test("gives three-query and five-query searches distinct Perplexity-style intent slots", async () => {
    const { buildTools } = await import("../src/tools")
    const balanced = buildTools({ queryCount: 3 }).searchSources
    const quality = buildTools({ queryCount: 5 }).searchSources

    expect(balanced?.description).toContain("appropriate expert lane—formal fatwa, practical guidance, or counseling")
    expect(quality?.description).toContain("Slot 5: Arabic terminology, madhhab disagreement")
  })

  test("enforces trusted source lanes when the model emits broad queries", async () => {
    const { routeSearchQueries } = await import("../src/tools/webSearch")

    expect(
      routeSearchQueries([
        "how should a Muslim plan their day",
        "Islam daily routines Quran hadith",
        "practical guidance for Muslims daily life",
      ]),
    ).toEqual([
      "how should a Muslim plan their day site:quran.com",
      "how should a Muslim plan their day site:sunnah.com",
      "how should a Muslim plan their day site:islamqa.info OR site:islamweb.net OR site:seekersguidance.org OR site:islamqa.org",
    ])
  })

  test("gives each research mode explicit query and fetch budgets", async () => {
    const { answerTokenBudget, getResearchPolicy, searchDeadline } = await import("../src/ask")
    const searxngSettings = await Bun.file(new URL("../../../infra/searxng/settings.yml", import.meta.url)).text()
    const searxngRenderer = await Bun.file(new URL("../../../infra/searxng/render_settings.py", import.meta.url)).text()
    const crawl4aiRenderer = await Bun.file(new URL("../../../infra/crawl4ai/render_config.py", import.meta.url)).text()

    expect(getResearchPolicy("speed")).toEqual({ queryCount: 3, initialFetches: 3, extraFetches: 0, maxSteps: 2 })
    expect(getResearchPolicy("balanced")).toEqual({ queryCount: 3, initialFetches: 3, extraFetches: 2, maxSteps: 3 })
    expect(getResearchPolicy("quality")).toEqual({ queryCount: 5, initialFetches: 3, extraFetches: 2, maxSteps: 3 })
    expect(searchDeadline("speed")).toBe(1_500)
    expect(searchDeadline("balanced")).toBe(1_500)
    expect(searchDeadline("quality")).toBe(1_800)
    expect(answerTokenBudget("speed")).toBe(300)
    expect(answerTokenBudget("balanced")).toBe(700)
    expect(answerTokenBudget("quality")).toBe(1_400)
    expect(searxngSettings).toContain("max_request_timeout: 1.2")
    expect(searxngSettings).toContain("pool_connections: 200")
    expect(searxngSettings).toContain("pool_maxsize: 100")
    expect(searxngSettings).toContain("- bing")
    expect(searxngSettings).toContain("- brave")
    expect(searxngSettings).toContain("- startpage")
    expect(searxngSettings).toContain("- mwmbl")
    expect(searxngSettings).toContain("- yandex")
    expect(searxngSettings).not.toContain("- duckduckgo\n")
    expect(searxngSettings).not.toContain("- qwant\n")
    expect(searxngSettings).not.toContain("- yep\n")
    expect(searxngSettings).not.toContain("- wiby\n")
    expect(searxngSettings.match(/timeout: 1\.1/g)).toHaveLength(5)
    expect(searxngRenderer).toContain('urlunsplit(("http", parsed.netloc')
    expect(crawl4aiRenderer).toContain('"server": f"http://{parsed.hostname}:{port}"')
    expect(searchDeadline("speed")).toBeGreaterThan(1_200)
  })

  test("deduplicates and authority-ranks results from multiple queries", async () => {
    const { rankSearchCandidates } = await import("../src/tools/webSearch")
    const result = rankSearchCandidates([
      {
        query: "intentions hadith",
        results: [
          { url: "https://example.com/post", title: "Post", snippet: "Commentary", score: 10, engines: ["google"] },
          { url: "https://sunnah.com/bukhari:1", title: "Bukhari 1", snippet: "Intentions", score: 2, engines: ["google"] },
        ],
      },
      {
        query: "actions by intentions",
        results: [
          { url: "https://sunnah.com/bukhari:1#top", title: "Bukhari 1", snippet: "Actions are by intentions", score: 1, engines: ["bing"] },
        ],
      },
    ])

    expect(result).toHaveLength(1)
    expect(result[0]?.url).toBe("https://sunnah.com/bukhari:1")
    expect(result[0]?.matchedQueries).toBe(2)
    expect(result[0]?.faviconUrl).toBe("https://sunnah.com/favicon.ico")
  })

  test("builds broad and trusted-source queries without a model", async () => {
    const { buildPrioritySearchQueries } = await import("../src/tools/webSearch")

    expect(buildPrioritySearchQueries("what is islam")).toEqual([
      "what is islam",
      "what is islam site:quran.com",
      "what is islam site:sunnah.com",
      "what is islam site:islamqa.info OR site:islamweb.net OR site:seekersguidance.org OR site:islamqa.org",
      "what is islam site:aboutislam.net OR site:productivemuslim.com OR site:dar-alifta.org OR site:aliftaa.jo",
    ])
  })

  test("keeps direct evidence pages but drops internal search pages", async () => {
    const { rankSearchCandidates } = await import("../src/tools/webSearch")
    const result = rankSearchCandidates([
      {
        query: "what is islam",
        results: [
          { url: "https://sunnah.com/search?q=islam", title: "Search", snippet: "Search", score: 4, engines: ["bing"] },
          { url: "https://sunnah.com/bukhari:50", title: "Bukhari 50", snippet: "Islam", score: 2, engines: ["bing"] },
          { url: "https://quran.com/3/85", title: "Quran 3:85", snippet: "Islam", score: 1, engines: ["bing"] },
          { url: "https://quran.com/learning-plans/what-is-ihsan", title: "What is Ihsan?", snippet: "Islam", score: 5, engines: ["bing"] },
        ],
      },
    ])

    expect(result.map((source) => source.url)).toEqual([
      "https://quran.com/3/85",
      "https://sunnah.com/bukhari:50",
    ])
  })

  test("puts the best Quran, hadith, and scholarly source in the first three", async () => {
    const { rankSearchCandidates } = await import("../src/tools/webSearch")
    const result = rankSearchCandidates([
      {
        query: "what is islam",
        results: [
          { url: "https://quran.com/3/85", title: "Quran 3:85", snippet: "Islam", score: 5, engines: ["bing"] },
          { url: "https://quran.com/5/3", title: "Quran 5:3", snippet: "Islam", score: 4, engines: ["bing"] },
          { url: "https://sunnah.com/bukhari:50", title: "Bukhari 50", snippet: "Islam", score: 3, engines: ["bing"] },
          { url: "https://yaqeeninstitute.org/what-islam-says-about/basics-of-islam", title: "Basics of Islam", snippet: "Islam", score: 2, engines: ["bing"] },
        ],
      },
    ])

    expect(result.slice(0, 3).map((source) => source.kind)).toEqual(["quran", "hadith", "web"])
  })

  test("prefers direct ayat and individual hadith over commentary and collection indexes", async () => {
    const { rankSearchCandidates } = await import("../src/tools/webSearch")
    const result = rankSearchCandidates([
      {
        query: "what is islam",
        results: [
          { url: "https://quran.com/10:71/tafsirs/en-tafisr-ibn-kathir", title: "Tafsir", snippet: "Islam", score: 5, engines: ["bing"] },
          { url: "https://quran.com/5/3", title: "Quran 5:3", snippet: "Islam", score: 1, engines: ["bing"] },
          { url: "https://sunnah.com/bukhari", title: "Bukhari", snippet: "Islam", score: 5, engines: ["bing"] },
          { url: "https://sunnah.com/bukhari:50", title: "Bukhari 50", snippet: "Islam", score: 1, engines: ["bing"] },
        ],
      },
    ])

    expect(result.map((source) => source.url)).toEqual([
      "https://quran.com/5/3",
      "https://sunnah.com/bukhari:50",
      "https://quran.com/10:71/tafsirs/en-tafisr-ibn-kathir",
    ])
  })

  test("classifies mixed domains by page role instead of trusting the whole domain", async () => {
    const { classifyDomain } = await import("../src/tools/sourceRegistry")

    expect(classifyDomain("https://aboutislam.net/counseling/ask-the-counselor/mental-health/ocd")?.role).toBe("counseling")
    expect(classifyDomain("https://aboutislam.net/live-session/ask-the-scholar-general-fatwa-session/")?.role).toBe("fatwa")
    expect(classifyDomain("https://aboutislam.net/ask-the-counselor-submit-question/")?.citable).toBe(false)
    expect(classifyDomain("https://productivemuslim.com/how-to-have-an-incredibly-productive-day-at-work/")?.role).toBe("guidance")
    expect(classifyDomain("https://www.dar-alifta.org/en/fatwa/details/8336/example")?.role).toBe("fatwa")
    expect(classifyDomain("https://reddit.com/r/islam/comments/example")?.role).toBe("discovery")
  })

  test("cites individual scholarly answers but treats their indexes as discovery only", async () => {
    const { classifyDomain } = await import("../src/tools/sourceRegistry")

    expect(classifyDomain("https://islamqa.info/en/answers/123/example")?.role).toBe("fatwa")
    expect(classifyDomain("https://islamqa.info/en")?.citable).toBe(false)
    expect(classifyDomain("https://www.islamweb.net/en/fatwa/356674/example")?.role).toBe("fatwa")
    expect(classifyDomain("https://www.islamweb.net/en/fatawa")?.citable).toBe(false)
    expect(classifyDomain("https://seekersguidance.org/answers/general-counsel/example/")?.role).toBe("fatwa")
    expect(classifyDomain("https://seekersguidance.org/answers/")?.citable).toBe(false)
    expect(classifyDomain("https://islamqa.org/shafii/shafiifiqh/30156/")?.role).toBe("fatwa")
    expect(classifyDomain("https://islamqa.org/sites/")?.citable).toBe(false)
  })

  test("keeps discovery pages as leads and never as citable evidence", async () => {
    const { filterToAllowlist } = await import("../src/tools/sourceRegistry")
    const result = filterToAllowlist([
      { url: "https://reddit.com/r/islam/comments/example" },
      { url: "https://productivemuslim.com/how-to-have-an-incredibly-productive-day-at-work/" },
    ])

    expect(result.citable.map((item) => item.source.role)).toEqual(["guidance"])
    expect(result.leads.map((item) => item.source.role)).toEqual(["discovery"])
  })

  test("ranks the appropriate expert lane before loosely related authority", async () => {
    const { rankSearchCandidates } = await import("../src/tools/webSearch")
    const practical = rankSearchCandidates([
      {
        query: "how do I plan my day as a Muslim",
        results: [
          { url: "https://sunnah.com/muslim:2908a", title: "Sahih Muslim 2908a", snippet: "A day concerning Muslims", score: 10, engines: ["bing"] },
          { url: "https://productivemuslim.com/how-to-have-an-incredibly-productive-day-at-work/", title: "How to plan a productive day at work", snippet: "Plan each day", score: 1, engines: ["bing"] },
        ],
      },
    ])
    const emotional = rankSearchCandidates([
      {
        query: "I feel lost and overwhelmed in my faith",
        results: [
          { url: "https://quran.com/33/33", title: "Quran 33:33", snippet: "Faith", score: 10, engines: ["bing"] },
          { url: "https://aboutislam.net/counseling/ask-the-counselor/mental-health/why-always-me", title: "I feel lost in my faith", snippet: "Overwhelmed and anxious", score: 1, engines: ["bing"] },
        ],
      },
    ])

    expect(practical[0]?.role).toBe("guidance")
    expect(emotional[0]?.role).toBe("counseling")
  })

  test("prefers IslamQA within an equally relevant fatwa lane", async () => {
    const { rankSearchCandidates } = await import("../src/tools/webSearch")
    const result = rankSearchCandidates([
      {
        query: "is this work income halal or haram",
        results: [
          { url: "https://www.islamweb.net/en/fatwa/1/example", title: "Is work income halal?", snippet: "A ruling on income", score: 1, engines: ["bing"] },
          { url: "https://islamqa.info/en/answers/1/example", title: "Is work income halal?", snippet: "A ruling on income", score: 1, engines: ["bing"] },
        ],
      },
    ])

    expect(result[0]?.domain).toBe("islamqa.info")
  })
})
