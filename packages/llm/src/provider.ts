import { createOpenAI } from "@ai-sdk/openai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { env } from "@sirathic/env/server"

export type AIProvider = typeof env.AI_PROVIDER

function providerKey(provider: AIProvider, apiKey?: string): string {
  const key = apiKey ?? (provider === "openai" ? env.OPENAI_API_KEY : env.OPENROUTER_API_KEY)
  if (key) return key

  const variable = provider === "openai" ? "OPENAI_API_KEY" : "OPENROUTER_API_KEY"
  throw new Error(`${variable} is required when AI_PROVIDER=${provider}`)
}

export function modelProvider(provider: AIProvider = env.AI_PROVIDER, apiKey?: string) {
  const key = providerKey(provider, apiKey)

  if (provider === "openai") return createOpenAI({ apiKey: key })
  return createOpenRouter({ apiKey: key })
}
