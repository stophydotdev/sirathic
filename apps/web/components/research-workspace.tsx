"use client"

import type { AskEvent, ResearchMode, ResearchSource, ResearchTrace, SearchCandidate, Source } from "@sirathic/core"
import { FormEvent, Fragment, useEffect, useRef, useState } from "react"

const sourceNames: Record<ResearchSource, string> = {
  quran: "Qur'an",
  hadith: "Hadith",
  web: "Scholarly web",
}

const toolNames: Record<string, string> = {
  searchSources: "Searching trusted sources",
  fetchSources: "Reading top evidence",
}

const suggestions = [
  "What does Islam teach about patience?",
  "How do the madhhabs differ on witr?",
  "Explain Qur'an 2:255 with sources.",
]

interface TrailStep {
  title: string
  detail: string
  tools?: string[]
}

interface HistoryItem {
  question: string
  answer: string
  sources: Source[]
  research?: ResearchTrace
  createdAt: number
}

const emptyResearch: ResearchTrace = { generatedQueries: [], queries: [], sources: [] }

function readHistory(): HistoryItem[] {
  try {
    const value = JSON.parse(localStorage.getItem("sirathic-history") ?? "[]") as unknown
    return Array.isArray(value) ? (value as HistoryItem[]) : []
  } catch {
    return []
  }
}

function InlineAnswer({ text, sources }: { text: string; sources: Source[] }) {
  return text.split(/(\[\d+\]|\*\*[^*]+\*\*)/g).map((part, index) => {
    const citation = part.match(/^\[(\d+)\]$/)
    if (citation) {
      const source = sources[Number(citation[1]) - 1]
      return source ? (
        <a
          className="citation"
          href={source.url}
          key={`${part}-${index}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open source ${citation[1]}`}
        >
          {citation[1]}
        </a>
      ) : null
    }
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>
    return <Fragment key={index}>{part}</Fragment>
  })
}

function AnswerContent({ answer, sources }: { answer: string; sources: Source[] }) {
  if (!answer) return <div className="waiting" aria-label="Waiting for evidence"><i /><i /><i /></div>

  const blocks = answer.trim().split(/\n{2,}/)
  return blocks.map((block, index) => {
    if (block.startsWith("## ")) return <h2 key={index}><InlineAnswer text={block.slice(3)} sources={sources} /></h2>
    if (block.startsWith("### ")) return <h3 key={index}><InlineAnswer text={block.slice(4)} sources={sources} /></h3>
    const lines = block.split("\n")
    if (lines.every((line) => /^[-*] /.test(line))) {
      return <ul key={index}>{lines.map((line, lineIndex) => <li key={lineIndex}><InlineAnswer text={line.slice(2)} sources={sources} /></li>)}</ul>
    }
    return <p key={index}><InlineAnswer text={lines.join(" ")} sources={sources} /></p>
  })
}

function SourceCard({ source }: { source: Source }) {
  const domain = source.domain || new URL(source.url).hostname.replace(/^www\./, "")
  return (
    <a className="source-card" href={source.url} target="_blank" rel="noreferrer">
      <span className="source-card-top"><b>[{source.index}]</b><em>{source.kind}</em></span>
      <h3>{source.label}</h3>
      <span className="source-identity">
        {/* Favicons are remote and come from the cited source at runtime. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={source.faviconUrl} alt="" width="16" height="16" loading="lazy" />
        <span>{domain}</span>
        <i aria-hidden="true">↗</i>
      </span>
    </a>
  )
}

function DiscoveryCard({ source, index, used }: { source: SearchCandidate; index: number; used: boolean }) {
  return (
    <a className="source-card discovery-card" href={source.url} target="_blank" rel="noreferrer">
      <span className="source-card-top"><b>{String(index + 1).padStart(2, "0")}</b><em>{used ? "Used in answer" : `${source.tier} · ${source.role}`}</em></span>
      <h3>{source.title}</h3>
      <p>{source.snippet || `Discovered through ${source.matchedQueries} search ${source.matchedQueries === 1 ? "query" : "queries"}.`}</p>
      <span className="source-identity">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={source.faviconUrl} alt="" width="16" height="16" loading="lazy" />
        <span>{source.source} · {source.domain}</span>
        <i aria-hidden="true">↗</i>
      </span>
    </a>
  )
}

export function ResearchWorkspace() {
  const [question, setQuestion] = useState("")
  const [activeQuestion, setActiveQuestion] = useState("")
  const [mode, setMode] = useState<ResearchMode>("balanced")
  const [selectedSources, setSelectedSources] = useState<ResearchSource[]>(["quran", "hadith", "web"])
  const [screen, setScreen] = useState<"ask" | "result">("ask")
  const [steps, setSteps] = useState<TrailStep[]>([])
  const [evidence, setEvidence] = useState<Source[]>([])
  const [answer, setAnswer] = useState("")
  const [researchTrace, setResearchTrace] = useState<ResearchTrace>(emptyResearch)
  const [answerState, setAnswerState] = useState("Waiting for evidence")
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const controllerRef = useRef<AbortController | null>(null)
  const startedAtRef = useRef(0)

  useEffect(() => setHistory(readHistory()), [])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setElapsed((performance.now() - startedAtRef.current) / 1000), 100)
    return () => window.clearInterval(timer)
  }, [running])

  function addStep(title: string, detail: string, tools?: string[]) {
    setSteps((current) => [...current, { title, detail, tools }])
  }

  function toggleSource(source: ResearchSource) {
    setSelectedSources((current) => current.includes(source) ? current.filter((item) => item !== source) : [...current, source])
  }

  function saveHistory(item: HistoryItem) {
    setHistory((current) => {
      const next = [item, ...current.filter((entry) => entry.question !== item.question)].slice(0, 12)
      localStorage.setItem("sirathic-history", JSON.stringify(next))
      return next
    })
  }

  function finish() {
    setRunning(false)
    controllerRef.current = null
  }

  function handleEvent(event: AskEvent, answerText: string, researchQuestion: string) {
    if (event.type === "research-start") {
      addStep("Research started", `${event.mode} mode · ${selectedSources.map((source) => sourceNames[source]).join(", ")}`)
    } else if (event.type === "search-results") {
      setResearchTrace({ generatedQueries: event.generatedQueries, queries: event.queries, sources: event.sources })
    } else if (event.type === "tool-complete") {
      const searched = event.tools.includes("searchSources")
      const detail = searched
        ? `${event.found} ranked candidate source${event.found === 1 ? "" : "s"} found`
        : `${event.found} source page${event.found === 1 ? "" : "s"} fetched`
      addStep(event.tools.map((tool) => toolNames[tool] ?? tool).join(" + "), detail, event.tools)
    } else if (event.type === "sources") {
      setEvidence(event.sources)
      setAnswerState(event.sources.length ? "Writing from evidence" : "No usable evidence found")
      addStep("Evidence assembled", `${event.sources.length} normalized sources ready for synthesis`)
    } else if (event.type === "answer-delta") {
      setAnswer(answerText)
    } else if (event.type === "answer-replace") {
      setAnswer(event.answer)
      setAnswerState("Draft withheld · citation check failed")
    } else if (event.type === "done") {
      setAnswer(event.answer)
      setEvidence(event.sources)
      setResearchTrace(event.research)
      setAnswerState(event.sources.length ? "Complete · citations linked" : "Completed without evidence")
      addStep("Answer completed", event.sources.length ? "Every numbered citation opens its evidence" : "No trusted evidence was available")
      finish()
      saveHistory({ question: researchQuestion, answer: event.answer, sources: event.sources, research: event.research, createdAt: Date.now() })
    } else if (event.type === "error") {
      setAnswer(event.message || "Research failed. Please try again.")
      setAnswerState("Research interrupted")
      addStep("Research stopped", event.message || "The source pipeline returned an error")
      finish()
    }
  }

  async function research(nextQuestion: string) {
    if (!nextQuestion.trim() || selectedSources.length === 0 || running) return
    const cleanQuestion = nextQuestion.trim()
    setActiveQuestion(cleanQuestion)
    setScreen("result")
    setSteps([])
    setEvidence([])
    setAnswer("")
    setResearchTrace(emptyResearch)
    setAnswerState("Waiting for evidence")
    setElapsed(0)
    setRunning(true)
    startedAtRef.current = performance.now()

    const controller = new AbortController()
    controllerRef.current = controller
    let answerText = ""

    try {
      const response = await fetch("/v1/ask", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({ question: cleanQuestion, stream: true, mode, sources: selectedSources }),
        signal: controller.signal,
      })
      if (!response.ok || !response.body) throw new Error(`Research request failed (${response.status})`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "")
        const frames = buffer.split("\n\n")
        buffer = frames.pop() ?? ""
        for (const frame of frames) {
          const data = frame.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim()
          if (!data) continue
          const event = JSON.parse(data) as AskEvent
          if (event.type === "answer-delta") answerText += event.delta
          handleEvent(event, answerText, cleanQuestion)
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      const message = error instanceof Error ? error.message : "Research failed. Please try again."
      handleEvent({ type: "error", message }, answerText, cleanQuestion)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void research(question)
  }

  function reset() {
    controllerRef.current?.abort()
    finish()
    setScreen("ask")
    setQuestion("")
  }

  function restore(item: HistoryItem) {
    controllerRef.current?.abort()
    setActiveQuestion(item.question)
    setEvidence(item.sources)
    setAnswer(item.answer)
    setResearchTrace(item.research ?? emptyResearch)
    setAnswerState("Saved research")
    setSteps([{ title: "Restored from local history", detail: "Run this inquiry again to refresh its sources" }])
    setElapsed(0)
    setRunning(false)
    setScreen("result")
  }

  return (
    <div className="app-shell">
      <aside className="rail">
        <button className="brand" type="button" onClick={reset} aria-label="Sirathic home">
          <span className="brand-mark">ص</span>
          <span><strong>Sirathic</strong><small>سِرَاطِك</small></span>
        </button>
        <button className="new-search" type="button" onClick={reset}><span>＋</span> New inquiry</button>
        <section className="history-section">
          <p className="eyebrow">Recent inquiries</p>
          <div className="history-list">
            {history.length ? history.map((item) => (
              <button className="history-item" type="button" key={item.createdAt} onClick={() => restore(item)}>{item.question}</button>
            )) : <p className="empty-history">Completed research will appear here.</p>}
          </div>
        </section>
        <div className="rail-note"><span>✓</span><p><strong>Cite or skip.</strong><br />Every claim should lead somewhere you can open.</p></div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>Islamic knowledge</span><i /><strong>Research desk</strong></div>
          <div className="status"><span /> Sources online</div>
        </header>

        {screen === "ask" ? (
          <section className="ask-panel">
            <div className="ornament" aria-hidden="true">۞</div>
            <p className="kicker">Evidence before eloquence</p>
            <h1>Ask Sirathic</h1>
            <p className="lede">Explore Qur&apos;an, hadith, and trusted scholarship with every answer anchored to its source.</p>
            <form className="ask-form" onSubmit={submit}>
              <label className="sr-only" htmlFor="question">Your Islamic research question</label>
              <textarea
                id="question"
                value={question}
                rows={3}
                dir={/[\u0600-\u06ff]/.test(question) ? "rtl" : "auto"}
                placeholder="What would you like to understand?"
                onChange={(event) => setQuestion(event.target.value)}
                required
              />
              <div className="composer-footer">
                <span>{selectedSources.length ? selectedSources.map((source) => sourceNames[source]).join(" · ") : "Select at least one source"}</span>
                <button type="submit" disabled={!question.trim() || !selectedSources.length}><span>Research</span><b>↗</b></button>
              </div>
            </form>

            <div className="controls-grid">
              <fieldset>
                <legend>Research depth</legend>
                <div className="segmented">
                  {(["speed", "balanced", "quality"] as const).map((item) => (
                    <button className={mode === item ? "active" : ""} type="button" key={item} onClick={() => setMode(item)}>
                      {item === "speed" ? "Brief" : item === "quality" ? "Deep" : "Balanced"}
                      <small>{item === "speed" ? "3 queries" : item === "quality" ? "5 queries" : "3 + recovery"}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>Source families</legend>
                <div className="source-toggles">
                  {(Object.keys(sourceNames) as ResearchSource[]).map((source) => (
                    <button className={selectedSources.includes(source) ? "active" : ""} type="button" key={source} onClick={() => toggleSource(source)}>{sourceNames[source]}</button>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="prompts"><span>Try asking</span>{suggestions.map((item) => <button type="button" key={item} onClick={() => setQuestion(item)}>{item}</button>)}</div>
          </section>
        ) : (
          <section className="result-shell">
            <div className="result-heading">
              <div><p className="kicker">Research record</p><h2>{activeQuestion}</h2></div>
              {running ? <button className="stop-button" type="button" onClick={() => { controllerRef.current?.abort(); addStep("Stopped by you", "The partial answer remains visible"); finish() }}>Stop</button> : <button className="stop-button" type="button" onClick={() => void research(activeQuestion)}>Refresh</button>}
            </div>
            <div className="research-layout">
              <aside className="research-log">
                <div className="section-label"><span>01</span><strong>Research trail</strong><time>{elapsed ? `${elapsed.toFixed(1)}s` : running ? "0.0s" : "saved"}</time></div>
                <ol className="steps">{steps.map((step, index) => (
                  <li className={running && index === steps.length - 1 ? "active" : ""} key={`${step.title}-${index}`}>
                    <strong>{step.title}</strong><span>{step.detail}</span>
                    {step.tools?.length ? <div className="tool-tags">{step.tools.map((tool) => <span key={tool}>{tool}</span>)}</div> : null}
                  </li>
                ))}</ol>
              </aside>
              <article className="answer-column">
                {researchTrace.queries.length ? <section className="discovery-section">
                  <div className="section-label"><span>02</span><strong>Search map</strong><em>{researchTrace.sources.length} sources discovered</em></div>
                  <div className="query-list">
                    {researchTrace.queries.map((query, index) => <div className="query-chip" key={`${query}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><p>{query}</p></div>)}
                  </div>
                  {researchTrace.generatedQueries.some((query, index) => query !== researchTrace.queries[index]) ? <details className="generated-queries"><summary>Show the original query plan</summary><ol>{researchTrace.generatedQueries.map((query, index) => <li key={`${query}-${index}`}>{query}</li>)}</ol></details> : null}
                  <div className="all-sources-heading"><strong>All ranked sources</strong><span>Open any result to inspect it yourself</span></div>
                  <div className="source-cards all-source-cards">{researchTrace.sources.map((source, index) => <DiscoveryCard source={source} index={index} used={evidence.some((item) => item.url === source.url)} key={source.url} />)}</div>
                </section> : null}
                {evidence.length ? <section className="sources-section">
                  <div className="section-label"><span>03</span><strong>Citation evidence</strong><em>{evidence.length} pages read</em></div>
                  <div className="source-cards">{evidence.map((source) => <SourceCard source={source} key={`${source.index}-${source.url}`} />)}</div>
                </section> : null}
                <section className="answer-section">
                  <div className="section-label"><span>04</span><strong>Synthesis</strong><em>{answerState}</em></div>
                  <div className="answer-paper"><div className="answer-rule" aria-hidden="true" /><div className="answer"><AnswerContent answer={answer} sources={evidence} /></div></div>
                </section>
              </article>
            </div>
          </section>
        )}

        <footer><span>Sirathic is a research tool, not a fatwa service.</span><span>Verify consequential decisions with a qualified scholar.</span></footer>
      </main>
    </div>
  )
}
