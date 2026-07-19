import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { env } from "@/lib/env";
import { ModelProvider } from "../../types";

const openrouterProvider: ModelProvider = {
  id: "openrouter",
  name: "OpenRouter",
  chatModels: [],
  languageModel: (key) => {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not set");
    }

    const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });

    return openrouter.chat(key);
  },
};

export default openrouterProvider;
