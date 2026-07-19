import { LanguageModel, ModelMessage } from "ai";
import { Chunk } from "@/lib/types";

type SearchAgentMode = "speed" | "balanced" | "quality";

type SearchAgentConfig = {
  llm: LanguageModel;
  mode: SearchAgentMode;
  systemInstructions: string;
};

type SearchAgentInput = {
  chatHistory: ModelMessage[];
  followUp: string;
  config: SearchAgentConfig;
};

type SearchAgentOutput = {
  sources: Chunk[];
  textStream: AsyncIterable<string>;
};

export type {
  SearchAgentMode,
  SearchAgentConfig,
  SearchAgentInput,
  SearchAgentOutput,
};
