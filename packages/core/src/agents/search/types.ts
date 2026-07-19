import type { LanguageModel } from "ai";
import type z from "zod";
import type {
  ChatTurnMessage,
  Chunk,
  ResearchSubStepData,
} from "@sirathic/core/types";
import type { ClassifierOutput } from "./classifier";

type SearchAgentMode = "speed" | "balanced" | "quality";

type SearchSources = "web" | "youtube";

type SearchAgentConfig = {
  llm: LanguageModel;
  mode: SearchAgentMode;
  sources: SearchSources[];
  systemInstructions: string;
};

type SearchAgentInput = {
  chatHistory: ChatTurnMessage[];
  followUp: string;
  config: SearchAgentConfig;
};

type ClassifierInput = {
  chatHistory: ChatTurnMessage[];
  query: string;
  llm: LanguageModel;
};

type ResearchSubStep = ResearchSubStepData;

type ActionOutput =
  | { type: "search_results"; results: Chunk[] }
  | { type: "reasoning"; reasoning: string }
  | { type: "done" };

type ActionEnabledConfig = {
  classification: ClassifierOutput;
  mode: SearchAgentMode;
  sources: SearchSources[];
};

type AdditionalConfig = {
  llm: LanguageModel;
  mode: SearchAgentMode;
  scrapedUrls: Set<string>;
  emitSubStep: (subStep: ResearchSubStep) => void;
};

type ResearchAction<S extends z.ZodObject<any> = z.ZodObject<any>> = {
  name: string;
  schema: S;
  getToolDescription: (config: { mode: SearchAgentMode }) => string;
  getDescription: (config: { mode: SearchAgentMode }) => string;
  enabled: (config: ActionEnabledConfig) => boolean;
  execute: (
    params: z.infer<S>,
    additionalConfig: AdditionalConfig,
  ) => Promise<ActionOutput>;
};

type ResearcherInput = {
  chatHistory: ChatTurnMessage[];
  followUp: string;
  classification: ClassifierOutput;
  config: SearchAgentConfig;
  onSubStep?: (subStep: ResearchSubStep) => void;
};

type ResearcherOutput = {
  findings: ActionOutput[];
  searchFindings: Chunk[];
};

export type {
  SearchAgentMode,
  SearchSources,
  SearchAgentConfig,
  SearchAgentInput,
  ClassifierInput,
  ResearchSubStep,
  ActionOutput,
  ActionEnabledConfig,
  AdditionalConfig,
  ResearchAction,
  ResearcherInput,
  ResearcherOutput,
};
