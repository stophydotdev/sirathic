import { dynamicTool } from "ai";
import { expect, test } from "bun:test";
import { z } from "zod";
import { type ChatMessage, sentMessage } from "../apps/server/src/shared/messages";
import { writingTools } from "../apps/server/src/chat/confirm";
import { loadSkill, skillsFor } from "../apps/server/src/chat/skills/builtIn";
import {
  answered,
  answerWith,
  chatTurn,
  type MockChunks,
  noInput,
  said,
  scriptedModel,
  systemTexts,
  toolNames,
  usage,
} from "./answerHelpers";

const inResearch = (messages: ChatMessage[]) =>
  chatTurn({ modelName: "sirathic-noor-1-flash", mode: "research", messages });

test("research mode loads the research skill before anything else, once", async () => {
  const [first] = await inResearch([said("1", "user", "what is zakat")]);
  const [again] = await inResearch([
    said("1", "user", "what is zakat"),
    {
      id: "2",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "load_skill",
          toolCallId: "c1",
          state: "output-available",
          input: { names: ["research"] },
          output: "Loaded research.",
        },
        { type: "text", text: "Which school do you follow?" },
      ],
    },
    said("3", "user", "Hanafi"),
  ]);
  expect([first?.toolChoice, toolNames(first), again?.toolChoice]).toEqual([
    { type: "required" },
    ["load_skill"],
    { type: "auto" },
  ]);
  expect(systemTexts(again)?.at(-1)).toContain("This is research mode.");
});

test("the question tool is offered in research mode only, and never in an unattended run", async () => {
  const loaded: ChatMessage[] = [
    said("1", "user", "what is zakat"),
    {
      id: "2",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "load_skill",
          toolCallId: "c1",
          state: "output-available",
          input: { names: ["research"] },
          output: "Loaded research.",
        },
      ],
    },
    said("3", "user", "Hanafi"),
  ];
  const offered = async (overrides: Partial<Parameters<typeof chatTurn>[0]>) => {
    const [call] = await chatTurn({ messages: loaded, ...overrides });
    return toolNames(call)?.includes("clarifying_questions");
  };
  expect([
    await offered({ mode: "research" }),
    await offered({ mode: "quick" }),
    await offered({ mode: "research", unattended: true }),
  ]).toEqual([true, false, false]);
});

test("a saved question card from before the rename replays as clarifying_questions", () => {
  const sent = sentMessage.parse({
    role: "assistant",
    parts: [
      {
        type: "tool-askUser",
        toolCallId: "c1",
        state: "output-available",
        input: { question: "Which school?", options: ["Hanafi", "Shafi'i"] },
        output: { shown: true },
      },
    ],
  });
  expect(sent.parts.map((part) => part.type)).toEqual(["tool-clarifying_questions"]);
});

const routine = {
  name: "Fajr nudge",
  prompt: "Remind me to pray Fajr on time",
  schedule: { kind: "daily", time: "05:00" },
};

const afterLoading = (skill: string): ChatMessage[] => [
  said("1", "user", "remind me every morning"),
  {
    id: "2",
    role: "assistant",
    parts: [
      {
        type: "dynamic-tool",
        toolName: "load_skill",
        toolCallId: "c0",
        state: "output-available",
        input: { names: [skill] },
        output: `Loaded ${skill}.`,
      },
    ],
  },
  said("3", "user", "yes, at 5"),
];

const callingTool = (toolName: string, input: typeof routine) =>
  [
    { type: "stream-start", warnings: [] },
    { type: "tool-call", toolCallId: "c1", toolName, input: JSON.stringify(input) },
    { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
  ] satisfies MockChunks;

test("creating a routine waits for the user's confirmation, and only a confirmed one runs", async () => {
  const automate = { owner: "o", timezone: "Asia/Tokyo" };
  const { body } = await chatTurn({ automate, messages: afterLoading("routines") }, [
    callingTool("createAutomation", routine),
    answered,
  ]);
  expect([
    body.includes('"type":"tool-approval-request"'),
    body.includes('"type":"tool-output-available"'),
  ]).toEqual([true, false]);
});

test("a plugin tool needs confirmation unless the plugin marks it read-only", () => {
  const lookup = dynamicTool({
    inputSchema: z.object({}),
    metadata: { annotations: { readOnlyHint: true } },
    execute: async () => "found",
  });
  const send = dynamicTool({ inputSchema: z.object({}), execute: async () => "sent" });
  expect(writingTools({ slack_find: lookup, slack_send: send })).toEqual(["slack_send"]);
});

test("a loaded skill's text joins the rules and its tools open, while the tool result only says it loaded", async () => {
  const skills = skillsFor({ mode: "quick", texting: true, inBot: true, timezone: "Asia/Tokyo" });
  const { model, seen } = scriptedModel(["load_skill"], ["study", "routines"]);
  await answerWith(model, {
    tools: {
      search_web: noInput,
      load_skill: loadSkill(skills),
      dueStudyItems: noInput,
      createAutomation: noInput,
    },
    skills,
    firstStep: undefined,
  }).generate({ prompt: "quiz me" });
  const [before, after] = seen;
  const result = JSON.stringify(after?.prompt.filter((message) => message.role === "tool"));
  expect([
    toolNames(before),
    toolNames(after),
    systemTexts(before)?.at(-1)?.includes("run it as short quizzes"),
    systemTexts(after)?.at(-1)?.includes("run it as short quizzes"),
    systemTexts(after)?.at(-1)?.includes("The user's time zone is Asia/Tokyo."),
    result.includes("short quizzes"),
    result.includes("Loaded study, routines."),
  ]).toEqual([
    ["search_web", "load_skill"],
    ["search_web", "load_skill", "dueStudyItems", "createAutomation"],
    false,
    true,
    true,
    false,
    true,
  ]);
});

test("a skill loaded in an earlier turn stays loaded", async () => {
  const skills = skillsFor({ mode: "quick", texting: false, inBot: false, timezone: undefined });
  const { model, seen } = scriptedModel([]);
  await answerWith(model, { skills, loaded: ["writing"] }).generate({ prompt: "shorter" });
  expect(systemTexts(seen[0])?.at(-1)).toContain("<rewrites>");
});
