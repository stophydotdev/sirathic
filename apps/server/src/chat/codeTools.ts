import { anthropic } from "@ai-sdk/anthropic";
import type { ToolSet } from "ai";
import { noorModel } from "../models/noor";

export const CODE_RULES = `You have a code sandbox, code_execution, for exact calculation. Any zakat, inheritance, nisab, hijri or date, or unit conversion that combines two or more figures goes through it, even when it looks easy. Do not work those numbers out in your head.
- Use it for meaningful calculation only. Never for a single sum or product, and never to display or format text.
- Its output is visible only to you, not to the user. Put every number you rely on in your answer in plain words and digits. The interface does not render LaTeX.
- Write one complete script per call that prints every final value. Do not make test calls.
- The sandbox has no internet. Pass it the figures you already have.`;

export const codeTools = (modelName: string): ToolSet =>
  noorModel(modelName) ? { code_execution: anthropic.tools.codeExecution_20260120() } : {};
