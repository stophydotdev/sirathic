import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "@sirathic/env/server";
import { type LanguageModelMiddleware, wrapLanguageModel } from "ai";
import type { Model } from "./chatgpt/codex";

const google =
  env.GEMINI_API_KEY === undefined
    ? undefined
    : createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });

export const GEMINI_MODELS: Model[] = google
  ? [{ slug: "gemini-3.6-flash", name: "Gemini 3.6 Flash", maker: "google" }]
  : [];

const lateSystemAsUser: LanguageModelMiddleware = {
  transformParams: async ({ params }) => ({
    ...params,
    prompt: params.prompt.map((message, index) =>
      index > 0 && message.role === "system"
        ? { role: "user", content: [{ type: "text", text: message.content }] }
        : message,
    ),
  }),
};

export const geminiModel = (slug: string | undefined) => {
  const known = GEMINI_MODELS.find((model) => model.slug === slug);
  return google && known
    ? wrapLanguageModel({
        model: google(known.slug),
        middleware: lateSystemAsUser,
      })
    : undefined;
};
