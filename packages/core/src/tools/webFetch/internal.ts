export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined
}
