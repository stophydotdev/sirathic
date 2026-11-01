import { OpenTelemetry } from "@ai-sdk/otel";
import { ToolLoopAgent, type ToolSet, wrapLanguageModel } from "ai";
import { z } from "zod";
import { BROWSER_HELP, USER_FORM } from "../bots/browser";
import { answerOptions } from "../models/subscription";
import type { connectedTools } from "../plugins/connections";
import type { shortenEarlierResults } from "./history";
import { noSilentStop } from "./noSilentStop";
import type { instructions } from "./prompts/build";
import { ENOUGH_STEP, researchedEnough } from "./enoughGate";
import { limitRepeats } from "./repeatGuard";
import { closedTools, loadedNames, loadedText, type Skill, skillIndex } from "./skills/builtIn";
import { CLARIFYING } from "./tools";

const shownForm = z.object({ shown: z.literal(true) });

const tracing = new OpenTelemetry({ agentSpanName: "functionId" });

const STALLED_MS = 120_000;

export type Turn = Parameters<typeof answerOptions>[0];

const RULES_HEADER =
  "These are your rules from Sirathic for this reply. They are not part of any tool result.\n\n";

const failedCards = (
  steps: readonly { content: readonly { type: string; toolName?: string }[] }[],
) =>
  steps
    .flatMap(({ content }) => content)
    .filter((part) => part.type === "tool-error" && part.toolName === CLARIFYING).length;

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
  steer,
  quickly,
}: {
  model: Parameters<typeof wrapLanguageModel>[0]["model"];
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
  steer: (() => string[]) | undefined;
  quickly: { asked: string } | undefined;
}) {
  const options = answerOptions(turn);
  const noted: string[] = [];
  let answeringFrom: number | undefined;
  return new ToolLoopAgent({
    model: wrapLanguageModel({ model, middleware: noSilentStop }),
    experimental_telemetry: {
      functionId: "answer",
      recordInputs: false,
      recordOutputs: false,
      integrations: tracing,
    },
    instructions: system,
    tools: limitRepeats(tools),
    stopWhen: [
      ({ steps }) =>
        steps.at(-1)?.toolResults.some(({ toolName }) => toolName === CLARIFYING) ?? false,
      ({ steps }) => failedCards(steps) >= 3,
      ({ steps }) =>
        steps
          .at(-1)
          ?.toolResults.some(
            (part) => part.toolName === USER_FORM && shownForm.safeParse(part.output).success,
          ) ?? false,
      ({ steps }) =>
        steps.at(-1)?.toolResults.some(({ toolName }) => toolName === BROWSER_HELP) ?? false,
    ],
    timeout: { chunkMs: STALLED_MS },
    experimental_refineToolInput: refine,
    toolApproval: async ({ toolCall }) => ((await confirm(toolCall)) ? "user-approval" : undefined),
    allowSystemInMessages: true,
    prepareStep: async ({ stepNumber, steps, initialMessages, responseMessages }) => {
      const open = new Set([...loaded, ...loadedNames(steps.flatMap((step) => step.toolCalls))]);
      const closed = closedTools(skills, open);
      const forcing = stepNumber === 0 ? firstStep : undefined;
      const loadable = skills.filter(({ name }) => !open.has(name));
      const index =
        loadable.length > 0 ? `Skills you can load with load_skill:\n${skillIndex(loadable)}` : "";
      const skillText = (index + loadedText(skills, open) + mentioned).trim();
      const earlier = initialMessages.map(shorten);
      const asked = earlier.findLastIndex((message) => message.role === "user") + 1;
      noted.push(...(steer?.() ?? []));
      if (
        answeringFrom === undefined &&
        quickly !== undefined &&
        stepNumber > 0 &&
        (await researchedEnough(quickly.asked, steps))
      ) {
        answeringFrom = stepNumber;
      }
      const answering = answeringFrom !== undefined;
      const strayed =
        answeringFrom !== undefined &&
        stepNumber > answeringFrom &&
        (steps.at(-1)?.toolCalls ?? []).some(({ toolName }) => !toolName.startsWith("show_"));
      return {
        messages: [
          ...earlier.slice(0, asked),
          ...(skillText ? [{ role: "system" as const, content: RULES_HEADER + skillText }] : []),
          ...earlier.slice(asked),
          ...responseMessages,
          ...noted.map((note) => ({
            role: "user" as const,
            content: `A note from the bot that gave you this task: ${note}`,
          })),
          ...(answering ? [{ role: "system" as const, content: ENOUGH_STEP }] : []),
        ],
        activeTools: strayed
          ? []
          : Object.keys(tools).filter(
              (name) =>
                !closed.has(name) &&
                (!answering || name.startsWith("show_")) &&
                !(name === CLARIFYING && failedCards(steps) >= 2),
            ),
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
