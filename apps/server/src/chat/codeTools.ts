import { anthropic } from "@ai-sdk/anthropic";
import type { ToolSet } from "ai";
import { noorModel } from "../models/noor";

export const CODE_RULES = `Using the code_execution tool:
- Use code_execution for meaningful computational work that requires actual calculation, data processing or analysis that you cannot perform directly in your thinking process. Any zakat, inheritance, nisab, hijri date or unit conversion that combines two or more figures counts, even when it looks easy.
- Do NOT use code_execution for: simple arithmetic, basic data display, printing raw data without processing, or tasks that can be accomplished with plain text responses.
- Do NOT make dummy tool calls, test calls, or calls that don't accomplish meaningful computational work toward the answer.
- Code output (stdout/stderr) is only visible to you, not the user. Do not use print statements to "present" or "display" information; the user will never see it. Only run code that produces artifacts (files) or computes values you need for your analysis. Put every number you rely on in your answer in plain words and digits. The interface does not render LaTeX.
- Call code_execution with the complete python script as the input that is ready for immediate execution.
- Internet access for the execution environment is disabled. Do NOT make external web requests or API calls as they will fail. Pass it the figures you already have.
- Minimize comments in the code, only write essential comments that guide your core logic.`;

export const codeTools = (modelName: string): ToolSet =>
  noorModel(modelName) ? { code_execution: anthropic.tools.codeExecution_20260120() } : {};
