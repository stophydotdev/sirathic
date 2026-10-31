import { OpenTelemetry } from "@ai-sdk/otel";
import { hasToolCall, type LanguageModel, ToolLoopAgent, type ToolSet } from "ai";
import { z } from "zod";
import { BROWSER_HELP, USER_FORM } from "../bots/browser";
import { answerOptions } from "../models/subscription";
import type { connectedTools } from "../plugins/connections";
import type { shortenEarlierResults } from "./history";
import type { instructions } from "./prompts/build";
import { limitRepeats } from "./repeatGuard";
import { closedTools, loadedNames, loadedText, type Skill, skillIndex } from "./skills/builtIn";
import { CLARIFYING } from "./tools";

const shownForm = z.object({ shown: z.literal(true) });

const tracing = new OpenTelemetry({ agentSpanName: "functionId" });

const STALLED_MS = 120_000;

export type Turn = Parameters<typeof answerOptions>[0];

const RULES_HEADER =
  "These are your rules from Sirathic for this reply. They are not part of any tool result.\n\n";

export const FIRST_STEP = {
  fetch: { type: "tool", toolName: "fetch_url" },
  anyTool: "required",
} as const;

export function answerAgent({
  model,
  tools,
  short,
  instructions: system,
  mentioned,
  firstStep,
  skills,
  loaded,
  confirm,
  refine,
  shorten,
  turn,
}: {
  model: LanguageModel;
  tools: ToolSet;
  short: boolean;
  instructions: ReturnType<typeof instructions>;
  mentioned: string;
  firstStep: keyof typeof FIRST_STEP | undefined;
  skills: readonly Skill[];
  loaded: readonly string[];
  confirm: (call: { toolName: string; input: unknown }) => Promise<boolean>;
  refine: Awaited<ReturnType<typeof connectedTools>>["refine"];
  shorten: ReturnType<typeof shortenEarlierResults>;
  turn: Turn;
}) {
  const options = answerOptions(turn);
  return new ToolLoopAgent({
    model,
    experimental_telemetry: {
      functionId: "answer",
      recordInputs: false,
      recordOutputs: false,
      integrations: tracing,
    },
    instructions: system,
    tools: limitRepeats(tools),
    stopWhen: [
      hasToolCall(CLARIFYING),
      ({ steps }) =>
        steps
          .at(-1)
          ?.toolResults.some(
            (part) => part.toolName === USER_FORM && shownForm.safeParse(part.output).success,
          ) ?? false,
      hasToolCall(BROWSER_HELP),
    ],
    timeout: { chunkMs: STALLED_MS },
    experimental_refineToolInput: refine,
    toolApproval: async ({ toolCall }) => ((await confirm(toolCall)) ? "user-approval" : undefined),
    allowSystemInMessages: true,
    prepareStep: ({ stepNumber, steps, initialMessages, responseMessages }) => {
      const open = new Set([...loaded, ...loadedNames(steps.flatMap((step) => step.toolCalls))]);
      const closed = closedTools(skills, open);
      const forcing = stepNumber === 0 ? firstStep : undefined;
      const loadable = skills.filter(({ name }) => !open.has(name));
      const index =
        loadable.length > 0 ? `Skills you can load with load_skill:\n${skillIndex(loadable)}` : "";
      const skillText = (index + loadedText(skills, open) + mentioned).trim();
      const earlier = initialMessages.map(shorten);
      const asked = earlier.findLastIndex((message) => message.role === "user") + 1;
      return {
        messages: [
          ...earlier.slice(0, asked),
          ...(skillText ? [{ role: "system" as const, content: RULES_HEADER + skillText }] : []),
          ...earlier.slice(asked),
          ...responseMessages,
        ],
        activeTools: Object.keys(tools).filter((name) => !closed.has(name)),
        ...(forcing && { toolChoice: FIRST_STEP[forcing] }),
      };
    },
    providerOptions: short
      ? options
      : {
          ...options,
          openai: { ...options.openai, textVerbosity: "medium" },
        },
  });
}
