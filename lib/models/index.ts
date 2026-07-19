import { LanguageModel } from "ai";
import { env } from "../env";
import openrouterProvider from "./providers/openrouter";

export const getLLM = (model?: string): LanguageModel => {
  return openrouterProvider.languageModel(model ?? env.LLM_MODEL);
};

export { providers } from "./providers";
