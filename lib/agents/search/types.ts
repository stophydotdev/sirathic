import { LanguageModel } from "ai";
import z from "zod";
import { ChatTurnMessage, Chunk, ResearchSubStepData } from "@/lib/types";
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
};

type AdditionalConfig = {
  llm: LanguageModel;
  mode: SearchAgentMode;
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
