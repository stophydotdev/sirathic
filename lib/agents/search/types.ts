import { LanguageModel } from "ai";
import { ChatTurnMessage, Chunk } from "@/lib/types";
import { ClassifierOutput } from "./classifier";

type SearchAgentMode = "speed" | "balanced" | "quality";

type SearchAgentConfig = {
  llm: LanguageModel;
  mode: SearchAgentMode;
  systemInstructions: string;
};

type SearchAgentInput = {
  chatHistory: ChatTurnMessage[];
  followUp: string;
  config: SearchAgentConfig;
};

type SearchAgentOutput = {
  classification: ClassifierOutput;
  sources: Chunk[];
  textStream: AsyncIterable<string>;
};

type ClassifierInput = {
  chatHistory: ChatTurnMessage[];
  query: string;
  llm: LanguageModel;
};

export type {
  SearchAgentMode,
  SearchAgentConfig,
  SearchAgentInput,
  SearchAgentOutput,
  ClassifierInput,
};
