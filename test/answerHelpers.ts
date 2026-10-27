import { simulateReadableStream, tool } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import type { ChatMessage } from "../apps/server/src/shared/messages";
import { DEFAULT_SETTINGS } from "../apps/server/src/shared/settings";
import { instructions } from "../apps/server/src/chat/prompts/build";
import { answerAgent, chatResponse } from "../apps/server/src/chat/response";

export const said = (id: string, role: ChatMessage["role"], text: string, createdAt?: number) =>
  ({ id, role, parts: [{ type: "text", text }], metadata: { createdAt } }) satisfies ChatMessage;

export const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

export type ModelCall = Parameters<MockLanguageModelV4["doGenerate"]>[0];

export type MockChunks =
  Awaited<ReturnType<MockLanguageModelV4["doStream"]>>["stream"] extends ReadableStream<infer Part>
    ? Part[]
    : never;

export const scriptedModel = (toolsCalled: string[], skillNames: string[] = []) => {
  const seen: ModelCall[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      seen.push(options);
      const next = toolsCalled[seen.length - 1];
      return {
        content: next
          ? [
              {
                type: "tool-call",
                toolCallId: crypto.randomUUID(),
                toolName: next,
                input: JSON.stringify(next === "load_skill" ? { names: skillNames } : {}),
              },
            ]
          : [{ type: "text", text: "Done." }],
        finishReason: { unified: next ? "tool-calls" : "stop", raw: undefined },
        usage,
        warnings: [],
      };
    },
  });
  return { model, seen };
};

export const noInput = tool({ inputSchema: z.object({}), execute: async () => "ok" });

export const answerWith = (
  model: MockLanguageModelV4,
  overrides: Partial<Parameters<typeof answerAgent>[0]>,
) =>
  answerAgent({
    model,
    tools: { search_web: noInput, update_memory: noInput },
    mode: "quick",
    settings: DEFAULT_SETTINGS,
    instructions: "INSTRUCTIONS",
    mentioned: "",
    firstStep: undefined,
    texting: false,
    skills: [],
    loaded: [],
    confirm: () => false,
    shorten: (message) => message,
    answerOptions: { anthropic: { thinking: { type: "adaptive" } } },
    ...overrides,
  });

export const toolNames = (call: ModelCall | undefined) => call?.tools?.map((entry) => entry.name);

export const systemTexts = (call: ModelCall | undefined) =>
  call?.prompt.flatMap((message) => (message.role === "system" ? [message.content] : []));

export const answered = [
  { type: "stream-start", warnings: [] },
  { type: "text-start", id: "1" },
  { type: "text-delta", id: "1", delta: "Done." },
  { type: "text-end", id: "1" },
  { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
] satisfies MockChunks;

export const chatTurn = async (
  overrides: Partial<Parameters<typeof chatResponse>[0]>,
  steps: MockChunks[] = [answered],
) => {
  const seen: ModelCall[] = [];
  const model = new MockLanguageModelV4({
    doStream: async (options) => {
      seen.push(options);
      return {
        stream: simulateReadableStream({
          chunks: steps[Math.min(seen.length, steps.length) - 1] ?? answered,
        }),
      };
    },
  });
  const response = chatResponse({
    models: { model, small: model },
    options: { answer: {} },
    modelName: "test",
    messages: [
      { id: "1", role: "user", parts: [{ type: "text", text: "what is zakat" }] },
      { id: "2", role: "assistant", parts: [{ type: "text", text: "A yearly duty." }] },
      { id: "3", role: "user", parts: [{ type: "text", text: "on gold?" }] },
    ],
    mode: "quick",
    abortSignal: new AbortController().signal,
    preferences: Promise.resolve(DEFAULT_SETTINGS),
    connected: Promise.resolve({ tools: {}, close: async () => [] }),
    project: Promise.resolve(undefined),
    userSkills: Promise.resolve([]),
    title: undefined,
    save: async () => {},
    record: () => {},
    owner: undefined,
    automate: undefined,
    ...overrides,
  });
  return Object.assign(seen, { body: await response.text() });
};

export const promptFor = (overrides: Partial<Parameters<typeof instructions>[0]> = {}) =>
  instructions({
    now: new Date(0),
    mode: "quick",
    settings: DEFAULT_SETTINGS,
    project: undefined,
    unattended: false,
    offered: {},
    skills: [],
    remembers: false,
    toolNotes: [],
    ...overrides,
  });
