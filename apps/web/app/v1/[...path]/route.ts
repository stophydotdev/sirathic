const LOCAL_API_URL = "http://127.0.0.1:3000"

interface RouteContext {
  params: Promise<{ path: string[] }>
}

function apiUrl(): string {
  return (process.env.SIRATHIC_API_URL ?? LOCAL_API_URL).replace(/\/$/, "")
}

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params
  const incomingUrl = new URL(request.url)
  const upstreamUrl = new URL(`/v1/${path.map(encodeURIComponent).join("/")}`, apiUrl())
  upstreamUrl.search = incomingUrl.search

  const headers = new Headers(request.headers)
  headers.delete("connection")
  headers.delete("content-length")
  headers.delete("host")

  const hasBody = request.method !== "GET" && request.method !== "HEAD"

  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
    })
    const responseHeaders = new Headers(upstream.headers)
    responseHeaders.delete("content-length")
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  } catch {
    return Response.json(
      { error: { code: "API_UNAVAILABLE", message: "Sirathic's research API is unavailable." } },
      { status: 502 },
    )
  }
}

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
export const OPTIONS = proxy
