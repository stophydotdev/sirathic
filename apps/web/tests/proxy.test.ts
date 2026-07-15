import { afterEach, describe, expect, test } from "bun:test"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("Next API proxy", () => {
  test("forwards POST bodies and streams the upstream response", async () => {
    let upstreamUrl = ""
    let upstreamBody = ""
    globalThis.fetch = Object.assign(
      async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        upstreamUrl = String(input)
        upstreamBody = typeof init?.body === "string" ? init.body : new TextDecoder().decode(init?.body as ArrayBuffer)
        return new Response('event: research-start\ndata: {"type":"research-start"}\n\n', {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        })
      },
      { preconnect: originalFetch.preconnect },
    )

    const { POST } = await import("../app/v1/[...path]/route")
    const request = new Request("http://localhost:3001/v1/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"question":"What is Islam?"}',
    })
    const response = await POST(request, { params: Promise.resolve({ path: ["ask"] }) })

    expect(upstreamUrl).toBe("http://127.0.0.1:3000/v1/ask")
    expect(upstreamBody).toBe('{"question":"What is Islam?"}')
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/event-stream")
    expect(await response.text()).toContain("event: research-start")
  })
})
