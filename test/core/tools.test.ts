import { describe, expect, test } from "bun:test"

process.env.OPENAI_API_KEY ||= "test-key"

describe("Islamic research tool selection", () => {
  test("maps Firecrawl v2 web search results", async () => {
    const { parseFirecrawlSearchResponse } = await import("../../packages/core/src/tools/webSearch")
    const result = parseFirecrawlSearchResponse(JSON.stringify({
      success: true,
      data: {
        web: [{
          url: "https://example.com/research",
          title: "Research result",
          description: "A useful result from Firecrawl.",
          metadata: { publishedTime: "2026-07-17" },
        }],
      },
    }))

    expect(result.results).toEqual([{
      url: "https://example.com/research",
      title: "Research result",
      snippet: "A useful result from Firecrawl.",
      score: 1,
      engines: ["firecrawl"],
      publishedDate: "2026-07-17",
    }])
    expect(result.unresponsiveEngines).toEqual([])
  })

  test("scrapes through the configured Firecrawl v2 endpoint", async () => {
    const { scrapeFirecrawl } = await import("../../packages/core/src/tools/webFetch/firecrawl")
    let request: { url: string; init?: RequestInit } | undefined
    const result = await scrapeFirecrawl(
      {
        url: "https://example.com/evidence",
        firecrawlUrl: "http://firecrawl-api.railway.internal:3002",
        firecrawlApiKey: "test-firecrawl-key",
      },
      async (input, init) => {
        request = { url: String(input), init }
        return Response.json({
          success: true,
          data: {
            markdown: "# Reliable evidence\n\nThe source text.",
            metadata: {
              title: "Reliable evidence",
              sourceURL: "https://example.com/evidence",
              statusCode: 200,
              language: "en",
            },
          },
        })
      },
    )

    expect(request?.url).toBe("http://firecrawl-api.railway.internal:3002/v2/scrape")
    expect(request?.init?.method).toBe("POST")
    const requestHeaders = request?.init?.headers as Record<string, string> | undefined
    expect(requestHeaders?.Authorization).toBe("Bearer test-firecrawl-key")
    expect(JSON.parse(String(request?.init?.body))).toMatchObject({
      url: "https://example.com/evidence",
      formats: ["markdown"],
      onlyMainContent: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.via).toBe("firecrawl")
    expect(result.title).toBe("Reliable evidence")
    expect(result.markdown).toContain("The source text.")
  })

  test("uses long evidence TTLs and short time-sensitive search TTLs", async () => {
    const { fetchCacheTtl } = await import("../../packages/core/src/tools/webFetch")
    const { searchCacheTtl } = await import("../../packages/core/src/tools/webSearch")

    expect(fetchCacheTtl("https://quran.com/2/183")).toBe(30 * 24 * 60 * 60)
    expect(fetchCacheTtl("https://sunnah.com/bukhari:1")).toBe(30 * 24 * 60 * 60)
    expect(fetchCacheTtl("https://islamqa.info/en/answers/1/example")).toBe(7 * 24 * 60 * 60)
    expect(searchCacheTtl("how to become a better Muslim")).toBe(6 * 60 * 60)
    expect(searchCacheTtl("latest moon sighting news today")).toBe(10 * 60)
  })

  test("exposes only the two batched research tools", async () => {
    const { buildTools } = await import("../../packages/core/src/tools")
    expect(Object.keys(buildTools())).toEqual(["searchSources", "fetchSources"])
    expect(Object.keys(buildTools({ sources: ["hadith"] }))).toEqual(["searchSources", "fetchSources"])
  })

  test("gives three-query and five-query searches distinct Perplexity-style intent slots", async () => {
    const { buildTools } = await import("../../packages/core/src/tools")
    const balanced = buildTools({ queryCount: 3 }).searchSources
    const quality = buildTools({ queryCount: 5 }).searchSources

    expect(balanced?.description).toContain("appropriate expert lane—formal fatwa, practical guidance, or counseling")
    expect(quality?.description).toContain("Slot 5: Arabic terminology, madhhab disagreement")
  })

  test("enforces trusted source lanes when the model emits broad queries", async () => {
    const { planResearchQueries, routeSearchQueries } = await import("../../packages/core/src/tools/webSearch")

    expect(
      routeSearchQueries([
        "how should a Muslim plan their day",
        "Islam daily routines Quran hadith",
        "practical guidance for Muslims daily life",
      ]),
    ).toEqual([
      "Quran evidence how should a Muslim plan their day site:quran.com",
      "Hadith evidence how should a Muslim plan their day site:sunnah.com",
      "practical Islamic guidance how should a Muslim plan their day site:productivemuslim.com",
    ])

    expect(planResearchQueries("In the Hanafi school, does bleeding invalidate wudu?", "balanced")[3]).toBe(
      "Hanafi ruling In the Hanafi school, does bleeding invalidate wudu? site:islamqa.org",
    )
    expect(planResearchQueries("I feel overwhelmed by anxiety. What should I do?", "balanced")[3]).toContain(
      "site:aboutislam.net",
    )
    expect(planResearchQueries("Is a marriage valid without a wali?", "speed")[2]).toBe(
      "scholarly ruling Is a marriage valid without a wali? site:islamqa.info",
    )
    expect(planResearchQueries("What is the best way to pray in Islam?", "speed")[2]).toBe(
      "Description of the Prophets Prayer What is the best way to pray in Islam? site:islamqa.info",
    )
    expect(planResearchQueries("ما حكم الجمع بين الصلاتين للمسافر؟", "speed")).toEqual([
      "آية من القرآن ما حكم الجمع بين الصلاتين للمسافر؟ site:quran.com",
      "حديث ما حكم الجمع بين الصلاتين للمسافر؟ site:sunnah.com",
      "فتوى ما حكم الجمع بين الصلاتين للمسافر؟ site:islamqa.info",
    ])
    expect(planResearchQueries("كيف يتعامل المسلم مع الوسواس في الصلاة؟", "balanced")[3]).toBe(
      "فتوى كيف يتعامل المسلم مع الوسواس في الصلاة؟ site:islamqa.info",
    )
    expect(planResearchQueries("Who is Muhammad?", "speed")).toEqual([
      "Who is Muhammad?",
      "Quran evidence Who is Muhammad? site:quran.com",
      "Islamic biography Who is Muhammad? site:islamqa.info",
    ])

    const qualityQueries = planResearchQueries("Can a traveler combine prayers?", "quality")
    expect(qualityQueries).toHaveLength(5)
    expect(qualityQueries).toContain("scholarly ruling Can a traveler combine prayers? site:islamqa.info")
    expect(qualityQueries).toContain("scholarly ruling Can a traveler combine prayers? site:islamweb.net")
    expect(qualityQueries.some((query) => query.includes(" OR site:"))).toBe(false)
  })

  test("gives each research mode explicit query and fetch budgets", async () => {
    const { answerTokenBudget, getResearchPolicy, searchDeadline } = await import("../../packages/core/src/ask")
    const searxngSettings = await Bun.file(new URL("../../searxng/settings.yml", import.meta.url)).text()
    const searxngRenderer = await Bun.file(new URL("../../scripts/searxng/render_settings.py", import.meta.url)).text()
    const searxngDockerfile = await Bun.file(new URL("../../searxng/Dockerfile", import.meta.url)).text()

    expect(getResearchPolicy("speed")).toEqual({ queryCount: 3, initialFetches: 3, extraFetches: 0, maxSteps: 2 })
    expect(getResearchPolicy("balanced")).toEqual({ queryCount: 5, initialFetches: 6, extraFetches: 2, maxSteps: 3 })
    expect(getResearchPolicy("quality")).toEqual({ queryCount: 5, initialFetches: 8, extraFetches: 2, maxSteps: 3 })
    expect(searchDeadline("speed")).toBe(10_000)
    expect(searchDeadline("balanced")).toBe(10_000)
    expect(searchDeadline("quality")).toBe(15_000)
    expect(answerTokenBudget("speed")).toBe(600)
    expect(answerTokenBudget("balanced")).toBe(1_600)
    expect(answerTokenBudget("quality")).toBe(2_200)
    expect(searxngSettings).toContain("request_timeout: 1.8")
    expect(searxngSettings).toContain("max_request_timeout: 2.8")
    expect(searxngSettings).toContain('autocomplete: "google"')
    expect(searxngSettings).toContain("SearxEngineCaptcha: 1")
    expect(searxngSettings).toContain("SearxEngineTooManyRequests: 1")
    expect(searxngSettings).toContain("pool_connections: 200")
    expect(searxngSettings).toContain("pool_maxsize: 100")
    expect(searxngSettings).not.toContain("- bing\n")
    expect(searxngSettings).not.toContain("- brave\n")
    expect(searxngSettings).toContain("- duckduckgo")
    expect(searxngSettings).toContain("- mojeek")
    expect(searxngSettings).toContain("- startpage")
    expect(searxngSettings).toContain("- wolframalpha")
    expect(searxngSettings).not.toContain("- yandex\n")
    expect(searxngSettings).toContain("- google")
    expect(searxngSettings).toContain("name: google\n    disabled: true")
    expect(searxngSettings).toContain("name: wolframalpha\n    disabled: true")
    expect(searxngSettings).not.toContain("- mwmbl\n")
    expect(searxngSettings).not.toContain("- qwant\n")
    expect(searxngSettings).not.toContain("- yahoo\n")
    expect(searxngSettings).not.toContain("- yep\n")
    expect(searxngSettings).not.toContain("- wiby\n")
    expect(searxngSettings).not.toContain("images")
    expect(searxngSettings).not.toContain("videos")
    expect(searxngSettings.match(/categories: \[general\]/g)).toHaveLength(5)
    expect(searxngSettings.match(/timeout: 1\.6/g)).toHaveLength(3)
    expect(searxngSettings).toContain("timeout: 2.0")
    expect(searxngSettings).toContain("timeout: 2.6")
    expect(searxngRenderer).toContain('os.environ.get("PROXY_URL")')
    expect(searxngRenderer).toContain('{"all://": [proxy]}')
    expect(searxngDockerfile).toContain("GRANIAN_BLOCKING_THREADS=32")
    expect(searchDeadline("speed")).toBeGreaterThan(2_100)
  })

  test("deduplicates and authority-ranks results from multiple queries", async () => {
    const { rankSearchCandidates } = await import("../../packages/core/src/tools/webSearch")
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

  test("requests and exposes up to thirty discoveries without increasing the page-fetch budget", async () => {
    const { MAX_DISCOVERY_RESULTS, SEARCH_RESULTS_PER_QUERY, selectDiscoveryResults } = await import("../../packages/core/src/tools/webSearch")
    const results = Array.from({ length: 36 }, (_, index) => ({
      url: `https://islamqa.info/en/answers/${index + 1}/research-result-${index + 1}`,
      title: `Research result ${index + 1}`,
      snippet: "Research evidence for the user question.",
      score: 1 / (index + 1),
      engines: ["firecrawl"],
    }))

    expect(MAX_DISCOVERY_RESULTS).toBe(30)
    expect(SEARCH_RESULTS_PER_QUERY).toBe(30)
    expect(selectDiscoveryResults([{ query: "research evidence", results }])).toHaveLength(30)
  })

  test("does not rank query-planner scaffolding above the user's subject", async () => {
    const { rankSearchCandidates } = await import("../../packages/core/src/tools/webSearch")
    const result = rankSearchCandidates([
      {
        query: "Quran evidence who is Muhammad site:quran.com",
        results: [{
          url: "https://quran.com/2/99/tafsirs/en-tafisr-ibn-kathir",
          title: "Surah Muhammad - 2",
          snippet: "A verse from Surah Muhammad.",
          score: 8,
          engines: ["startpage"],
        }],
      },
      {
        query: "Islamic biography who is Muhammad site:islamqa.info",
        results: [{
          url: "https://islamqa.info/en/answers/11575/who-is-muhammad",
          title: "Who Is Muhammad? - Islam Question & Answer",
          snippet: "A concise biography of the Prophet Muhammad.",
          score: 2,
          engines: ["startpage"],
        }],
      },
    ])

    expect(result[0]?.url).toBe("https://islamqa.info/en/answers/11575/who-is-muhammad")
  })

  test("builds broad and trusted-source queries without a model", async () => {
    const { buildPrioritySearchQueries } = await import("../../packages/core/src/tools/webSearch")

    expect(buildPrioritySearchQueries("what is islam")).toEqual([
      "what is islam",
      "Quran evidence what is islam site:quran.com",
      "Hadith evidence what is islam site:sunnah.com",
      "scholarly ruling what is islam site:islamqa.info",
      "scholarly ruling what is islam site:islamweb.net",
    ])
  })

  test("keeps direct evidence pages but drops internal search pages", async () => {
    const { rankSearchCandidates } = await import("../../packages/core/src/tools/webSearch")
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
    const { rankSearchCandidates } = await import("../../packages/core/src/tools/webSearch")
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
    const { rankSearchCandidates } = await import("../../packages/core/src/tools/webSearch")
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
    const { classifyDomain } = await import("../../packages/core/src/tools/sourceRegistry")

    expect(classifyDomain("https://aboutislam.net/counseling/ask-the-counselor/mental-health/ocd")?.role).toBe("counseling")
    expect(classifyDomain("https://aboutislam.net/live-session/ask-the-scholar-general-fatwa-session/")?.role).toBe("fatwa")
    expect(classifyDomain("https://aboutislam.net/ask-the-counselor-submit-question/")?.citable).toBe(false)
    expect(classifyDomain("https://productivemuslim.com/how-to-have-an-incredibly-productive-day-at-work/")?.role).toBe("guidance")
    expect(classifyDomain("https://www.dar-alifta.org/en/fatwa/details/8336/example")?.role).toBe("fatwa")
    expect(classifyDomain("https://reddit.com/r/islam/comments/example")?.role).toBe("discovery")
  })

  test("cites individual scholarly answers but treats their indexes as discovery only", async () => {
    const { classifyDomain } = await import("../../packages/core/src/tools/sourceRegistry")

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
    const { filterToAllowlist } = await import("../../packages/core/src/tools/sourceRegistry")
    const result = filterToAllowlist([
      { url: "https://reddit.com/r/islam/comments/example" },
      { url: "https://productivemuslim.com/how-to-have-an-incredibly-productive-day-at-work/" },
    ])

    expect(result.citable.map((item) => item.source.role)).toEqual(["guidance"])
    expect(result.leads.map((item) => item.source.role)).toEqual(["discovery"])
  })

  test("ranks the appropriate expert lane before loosely related authority", async () => {
    const { rankSearchCandidates } = await import("../../packages/core/src/tools/webSearch")
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
    const { rankSearchCandidates } = await import("../../packages/core/src/tools/webSearch")
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
