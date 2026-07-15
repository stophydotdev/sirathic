import { describe, expect, test } from "bun:test"

process.env.DATABASE_URL ||= "postgres://unused"
process.env.OPENAI_API_KEY ||= "test-openai-key"
process.env.OPENROUTER_API_KEY ||= "test-openrouter-key"

const { chatModel } = await import("../src/index")

describe("AI providers", () => {
  test("creates an OpenAI Chat Completions model", () => {
    const model = chatModel("gpt-4o-mini", { provider: "openai", apiKey: "test-openai-key" })

    expect(model.provider).toBe("openai.chat")
    expect(model.modelId).toBe("gpt-4o-mini")
  })

  test("creates an OpenRouter model", () => {
    const model = chatModel("deepseek/deepseek-v4-flash", { provider: "openrouter", apiKey: "test-openrouter-key" })

    expect(model.provider).toBe("openrouter")
    expect(model.modelId).toBe("deepseek/deepseek-v4-flash")
  })

  test("does not fall back when the selected provider has no key", () => {
    expect(() => chatModel("gpt-4o-mini", { provider: "openai", apiKey: "" })).toThrow(
      "OPENAI_API_KEY is required when AI_PROVIDER=openai",
    )
  })

  test("rejects models outside the two approved low-cost choices", () => {
    expect(() => chatModel("gpt-5", { provider: "openai" })).toThrow(
      "gpt-5 is not allowed for openai; use gpt-4o-mini",
    )
  })
})
