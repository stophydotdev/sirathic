const $ = (selector) => document.querySelector(selector)
const $$ = (selector) => [...document.querySelectorAll(selector)]

const state = {
  mode: 'balanced',
  sources: ['quran', 'hadith', 'web'],
  evidence: [],
  answer: '',
  controller: null,
  startedAt: 0,
  timer: null,
}

const sourceNames = { quran: "Qur'an", hadith: 'Hadith', web: 'Scholarly web' }
const toolNames = {
  searchSources: 'Searching multiple queries',
  fetchSources: 'Reading top sources',
}

function escapeHtml(value = '') {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
}

function renderMarkdown(markdown) {
  let html = escapeHtml(markdown)
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/\[([0-9]+)\]/g, (_, rawIndex) => {
    const index = Number(rawIndex)
    const source = state.evidence[index - 1]
    if (!source) return ''
    return `<a class="citation" href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer" aria-label="Open source ${index}">${index}</a>`
  })
  const blocks = html.split(/\n{2,}/).map((block) => {
    if (/^<(h2|h3)/.test(block)) return block
    const lines = block.split('\n')
    if (lines.every((line) => /^[-*] /.test(line))) return `<ul>${lines.map((line) => `<li>${line.slice(2)}</li>`).join('')}</ul>`
    return `<p>${block.replace(/\n/g, '<br>')}</p>`
  })
  return blocks.join('')
}

function selectedSources() {
  return $$('#source-toggles input:checked').map((input) => input.value)
}

function updateSourceSummary() {
  state.sources = selectedSources()
  $('#source-summary').textContent = state.sources.map((source) => sourceNames[source]).join(' · ') || 'Select at least one source'
}

function addStep(title, description = '', tools = []) {
  $$('.step.active').forEach((step) => step.classList.remove('active'))
  const item = document.createElement('li')
  item.className = 'step active'
  const tags = tools.length ? `<div class="tool-tags">${tools.map((tool) => `<span>${escapeHtml(tool)}</span>`).join('')}</div>` : ''
  item.innerHTML = `<strong>${escapeHtml(title)}</strong>${escapeHtml(description)}${tags}`
  $('#steps').append(item)
}

function renderSources(sources) {
  state.evidence = sources
  $('#sources-section').hidden = sources.length === 0
  $('#source-count').textContent = `${sources.length} source${sources.length === 1 ? '' : 's'}`
  $('#source-cards').innerHTML = sources.map((source, index) => {
    let domain = ''
    try { domain = new URL(source.url).hostname.replace(/^www\./, '') } catch {}
    const favicon = source.faviconUrl || (domain ? `https://${domain}/favicon.ico` : '')
    return `<a class="source-card" href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">
      <span class="source-index">[${index + 1}] ${escapeHtml(source.kind || 'source')}</span>
      <h3>${escapeHtml(source.label)}</h3>
      <span class="source-identity"><img class="source-favicon" src="${escapeHtml(favicon)}" alt="" loading="lazy"><span class="source-domain">${escapeHtml(domain)}</span></span>
    </a>`
  }).join('')
  $$('.source-favicon').forEach((image) => image.addEventListener('error', () => image.classList.add('failed')))
}

function resetResult(question) {
  state.evidence = []
  state.answer = ''
  $('#ask-panel').hidden = true
  $('#result-shell').hidden = false
  $('#result-question').textContent = question
  $('#steps').innerHTML = ''
  $('#source-cards').innerHTML = ''
  $('#sources-section').hidden = true
  $('#answer').innerHTML = '<div class="waiting"><i></i><i></i><i></i></div>'
  $('#answer-state').textContent = 'Waiting for evidence'
  $('#stop-button').hidden = false
  state.startedAt = performance.now()
  clearInterval(state.timer)
  state.timer = setInterval(() => { $('#elapsed').textContent = `${((performance.now() - state.startedAt) / 1000).toFixed(1)}s` }, 100)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function handleEvent(type, payload) {
  if (type === 'research-start') addStep('Research started', `${payload.mode} mode · ${state.sources.map((source) => sourceNames[source]).join(', ')}`)
  if (type === 'tool-complete') {
    const labels = payload.tools.map((tool) => toolNames[tool] || tool)
    const searched = payload.tools.includes('searchSources')
    const detail = searched
      ? `${payload.found} ranked candidate source${payload.found === 1 ? '' : 's'} found`
      : `${payload.found} source page${payload.found === 1 ? '' : 's'} fetched`
    addStep(labels.join(' + '), detail, payload.tools)
  }
  if (type === 'sources') {
    renderSources(payload.sources)
    addStep('Evidence assembled', `${payload.sources.length} normalized sources ready for synthesis`)
    $('#answer-state').textContent = 'Writing from evidence'
  }
  if (type === 'answer-delta') {
    state.answer += payload.delta
    $('#answer').innerHTML = renderMarkdown(state.answer)
  }
  if (type === 'answer-replace') {
    state.answer = payload.answer
    $('#answer').innerHTML = renderMarkdown(payload.answer)
    $('#answer-state').textContent = 'Draft withheld · citation check failed'
  }
  if (type === 'done') {
    state.answer = payload.answer
    renderSources(payload.sources)
    $('#answer').innerHTML = renderMarkdown(payload.answer)
    $('#answer-state').textContent = 'Complete · citation linked'
    addStep('Answer completed', 'Every numbered citation links to the evidence above')
    finishRequest()
    saveHistory($('#result-question').textContent, payload)
  }
  if (type === 'error') {
    $('#answer').innerHTML = `<p class="error-message">${escapeHtml(payload.message || 'Research failed. Please try again.')}</p>`
    $('#answer-state').textContent = 'Research interrupted'
    addStep('Research stopped', payload.message || 'The source pipeline returned an error')
    finishRequest()
  }
}

async function research(question) {
  if (!state.sources.length) return
  resetResult(question)
  state.controller = new AbortController()

  try {
    const response = await fetch('/v1/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      signal: state.controller.signal,
      body: JSON.stringify({ question, stream: true, mode: state.mode, sources: state.sources }),
    })
    if (!response.ok || !response.body) throw new Error(`Research request failed (${response.status})`)

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')
      const frames = buffer.split('\n\n')
      buffer = frames.pop() || ''
      for (const frame of frames) {
        let event = 'message'
        let data = ''
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          if (line.startsWith('data:')) data += line.slice(5).trim()
        }
        if (data) handleEvent(event, JSON.parse(data))
      }
    }
  } catch (error) {
    if (error.name !== 'AbortError') handleEvent('error', { message: error.message })
  }
}

function finishRequest() {
  clearInterval(state.timer)
  state.controller = null
  $('#stop-button').hidden = true
  $$('.step.active').forEach((step) => step.classList.remove('active'))
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem('sirathic-history') || '[]') } catch { return [] }
}

function saveHistory(question, result) {
  const history = getHistory().filter((item) => item.question !== question)
  history.unshift({ question, answer: result.answer, sources: result.sources, createdAt: Date.now() })
  localStorage.setItem('sirathic-history', JSON.stringify(history.slice(0, 12)))
  renderHistory()
}

function loadHistory(item) {
  resetResult(item.question)
  clearInterval(state.timer)
  state.answer = item.answer
  renderSources(item.sources)
  $('#answer').innerHTML = renderMarkdown(item.answer)
  $('#answer-state').textContent = 'Saved research'
  $('#elapsed').textContent = 'saved'
  $('#stop-button').hidden = true
  addStep('Restored from local history', 'Run the inquiry again to refresh its sources')
  $$('.step.active').forEach((step) => step.classList.remove('active'))
}

function renderHistory() {
  const history = getHistory()
  $('#history').innerHTML = history.length
    ? history.map((item, index) => `<button class="history-item" type="button" data-history="${index}">${escapeHtml(item.question)}</button>`).join('')
    : '<p class="empty-history">Your completed research will appear here.</p>'
  $$('[data-history]').forEach((button) => button.addEventListener('click', () => loadHistory(history[Number(button.dataset.history)])))
}

$('#ask-form').addEventListener('submit', (event) => {
  event.preventDefault()
  const question = $('#question').value.trim()
  if (question && state.sources.length) research(question)
})

$$('[data-mode]').forEach((button) => button.addEventListener('click', () => {
  $$('[data-mode]').forEach((item) => item.classList.remove('active'))
  button.classList.add('active')
  state.mode = button.dataset.mode
}))

$$('#source-toggles input').forEach((input) => input.addEventListener('change', updateSourceSummary))
$$('.prompts button').forEach((button) => button.addEventListener('click', () => { $('#question').value = button.textContent; $('#question').focus() }))
$('#new-search').addEventListener('click', () => {
  state.controller?.abort()
  finishRequest()
  $('#result-shell').hidden = true
  $('#ask-panel').hidden = false
  $('#question').value = ''
  $('#question').focus()
})
$('#stop-button').addEventListener('click', () => { state.controller?.abort(); addStep('Stopped by you', 'The partial answer remains visible'); finishRequest() })
$('#question').addEventListener('input', (event) => { event.target.dir = /[\u0600-\u06ff]/.test(event.target.value) ? 'rtl' : 'auto' })

updateSourceSummary()
renderHistory()
