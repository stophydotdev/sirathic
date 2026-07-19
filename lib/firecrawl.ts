import { env } from "./env";
import { FirecrawlResponse } from "./types";

export class FirecrawlError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "FirecrawlError";
  }
}

export const firecrawl = async <T>(
  path: string,
  body: Record<string, unknown>,
  timeoutMs = 60_000,
): Promise<T> => {
  const res = await fetch(`${env.FIRECRAWL_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new FirecrawlError(res.status, text || res.statusText);
  }

  const json = (await res.json()) as FirecrawlResponse & T;

  if (!json.success) {
    throw new FirecrawlError(
      res.status,
      json.error ?? "Unknown Firecrawl error",
    );
  }

  return json;
};
