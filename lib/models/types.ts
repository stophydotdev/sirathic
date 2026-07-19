import { LanguageModel } from "ai";

type Model = {
  name: string;
  key: string;
};

type ModelProvider = {
  id: string;
  name: string;
  chatModels: Model[];
  languageModel: (key: string) => LanguageModel;
};

export type { Model, ModelProvider };
