import { env } from "@sirathic/env/server"
import { modelProvider, type AIProvider } from "./provider"

function configuredModel(provider: AIProvider): string {
  return provider === "openai" ? env.OPENAI_MODEL : env.OPENROUTER_MODEL
}

export function chatModel(
  model?: string,
  options: { provider?: AIProvider; apiKey?: string } = {},
) {
  const provider = options.provider ?? env.AI_PROVIDER
  const allowedModel = configuredModel(provider)
  const selectedModel = model ?? allowedModel
  if (selectedModel !== allowedModel) {
    throw new Error(`${selectedModel} is not allowed for ${provider}; use ${allowedModel}`)
  }

  const selectedProvider = modelProvider(provider, options.apiKey)
  if (provider === "openai" && "chat" in selectedProvider) return selectedProvider.chat(selectedModel)
  return selectedProvider(selectedModel)
}
