import { createHash } from "node:crypto"
import { env } from "@sirathic/env/server"
import { RedisClient } from "bun"

const KEY_VERSION = "v1"
const inFlight = new Map<string, Promise<unknown>>()

let client: RedisClient | undefined
let connecting: Promise<void> | undefined

function cacheClient() {
  if (!env.REDIS_URL) return undefined
  if (!client) {
    const created = new RedisClient(env.REDIS_URL, {
      connectionTimeout: 1_000,
      idleTimeout: 1_000,
      autoReconnect: false,
      enableOfflineQueue: false,
    })
    created.onclose = () => {
      if (client === created) client = undefined
    }
    client = created
  }
  return client
}

async function connectedClient() {
  const current = cacheClient()
  if (!current) return undefined
  if (current.connected) return current

  connecting ??= current.connect().then(() => undefined).finally(() => {
    connecting = undefined
  })

  try {
    await connecting
    return current.connected ? current : undefined
  } catch {
    return undefined
  }
}

function discardClient(current: RedisClient): void {
  try {
    current.close()
  } catch {
    // The socket may already be closed.
  }
  if (client === current) client = undefined
}

async function runCacheCommand<T>(command: (current: RedisClient) => Promise<T>): Promise<T | undefined> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = await connectedClient()
    if (!current) continue
    try {
      return await command(current)
    } catch {
      discardClient(current)
    }
  }
  return undefined
}

export function cacheKey(namespace: string, identity: unknown): string {
  const digest = createHash("sha256").update(JSON.stringify(identity)).digest("hex")
  return `sirathic:${KEY_VERSION}:${namespace}:${digest}`
}

export async function readCache<T>(key: string): Promise<T | undefined> {
  try {
    const value = await runCacheCommand((current) => current.get(key))
    return value ? (JSON.parse(value) as T) : undefined
  } catch {
    return undefined
  }
}

export async function writeCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (ttlSeconds <= 0) return
  try {
    await runCacheCommand((current) => current.set(key, JSON.stringify(value), "EX", ttlSeconds))
  } catch {
    // Cache writes are best effort. Upstream results remain the source of truth.
  }
}

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
  shouldCache: (value: T) => boolean = () => true,
): Promise<T> {
  const hit = await readCache<T>(key)
  if (hit !== undefined) return hit

  const existing = inFlight.get(key) as Promise<T> | undefined
  if (existing) return existing

  const pending = load()
    .then(async (value) => {
      if (shouldCache(value)) await writeCache(key, value, ttlSeconds)
      return value
    })
    .finally(() => inFlight.delete(key))

  inFlight.set(key, pending)
  return pending
}

export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLocaleLowerCase("en")
}
