import type { ModelProvider } from "../types";
import openrouterProvider from "./openrouter";

export const providers: Record<string, ModelProvider> = {
  openrouter: openrouterProvider,
};
