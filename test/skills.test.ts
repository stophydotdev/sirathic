import { dynamicTool } from "ai";
import { expect, test } from "bun:test";
import { z } from "zod";
import { type ChatMessage, sentMessage } from "../apps/server/src/shared/messages";
import { needsApproval, writingTools } from "../apps/server/src/chat/confirm";
import {
  loadSkill,
  loadedText,
  skillIndex,
  skillsFor,
} from "../apps/server/src/chat/skills/builtIn";
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

test("research mode has the research skill loaded from the start, without a step for it", async () => {
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
  expect([
    first?.toolChoice,
    systemTexts(first)?.at(-1)?.includes("This is research mode."),
    again?.toolChoice,
  ]).toEqual([{ type: "tool", toolName: "search_web" }, true, { type: "auto" }]);
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

function routineInput() {
  return { name: "Fajr", prompt: "Remind me", schedule: { kind: "daily", time: "05:40" } };
}

test.each([
  ["askUser", { question: "Which school?" }, "clarifying_questions", { question: "Which school?" }],
  ["remember", { fact: "Is 28", replaces: null }, "update_memory", { write: "Is 28" }],
  [
    "learnAboutUser",
    { text: "Is 29", replaces: "Is 28" },
    "update_memory",
    { write: "Is 29", forget: "Is 28" },
  ],
  ["createAutomation", routineInput(), "update_routine", { action: "create", ...routineInput() }],
  ["listAutomations", {}, "list_routines", {}],
])(
  "a saved %s call replays as %s with an input the new tool accepts",
  (old, input, current, expected) => {
    const sent = sentMessage.parse({
      role: "assistant",
      parts: [
        { type: `tool-${old}`, toolCallId: "c1", state: "output-available", input, output: {} },
      ],
    });
    expect(
      sent.parts.map((part) => [
        part.type,
        "input" in part ? JSON.parse(JSON.stringify(part.input)) : undefined,
      ]),
    ).toEqual([[`tool-${current}`, expected]]);
  },
);

const routine = {
  name: "Fajr nudge",
  prompt: "Remind me to pray Fajr on time",
  schedule: { kind: "daily", time: "05:00" },
};

const noSkills = { canWriteSkills: false, userSkills: [], offered: {}, plugins: {} };

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

const callingTool = (toolName: string, input: typeof routine & { action: string }) =>
  [
    { type: "stream-start", warnings: [] },
    { type: "tool-call", toolCallId: "c1", toolName, input: JSON.stringify(input) },
    { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
  ] satisfies MockChunks;

test("creating a routine waits for the user's confirmation, and only a confirmed one runs", async () => {
  const automate = { owner: "o", timezone: "Asia/Tokyo" };
  const { body } = await chatTurn({ automate, messages: afterLoading("routines") }, [
    callingTool("update_routine", { action: "create", ...routine }),
    answered,
  ]);
  expect([
    body.includes('"type":"tool-approval-request"'),
    body.includes('"type":"tool-output-available"'),
  ]).toEqual([true, false]);
});

test.each([
  ["update_routine", { action: "create" }, true],
  ["update_routine", { action: "edit" }, true],
  ["update_routine", { action: "delete" }, true],
  ["update_routine", { action: "pause" }, false],
  ["update_skill", { action: "delete" }, true],
  ["install_plugin", { id: "googlecalendar" }, true],
  ["search_plugins", { query: "calendar" }, false],
  ["update_skill", { action: "write" }, false],
  ["update_routine", { action: "resume" }, false],
  ["list_routines", {}, false],
  ["slack_send", {}, true],
])("the %s call %p needs the user's confirmation: %p", (toolName, input, expected) => {
  expect(needsApproval({ toolName, input }, new Set(["slack_send"]))).toBe(expected);
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
  const skills = skillsFor({
    ...noSkills,
    mode: "quick",
    texting: true,
    inBot: true,
    timezone: "Asia/Tokyo",
  });
  const { model, seen } = scriptedModel(["load_skill"], ["study", "routines"]);
  await answerWith(model, {
    tools: {
      search_web: noInput,
      load_skill: loadSkill(skills),
      dueStudyItems: noInput,
      update_routine: noInput,
      list_routines: noInput,
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
    ["search_web", "load_skill", "dueStudyItems", "update_routine", "list_routines"],
    false,
    true,
    true,
    false,
    true,
  ]);
});

test("a skill loaded in an earlier turn stays loaded", async () => {
  const skills = skillsFor({
    ...noSkills,
    mode: "quick",
    texting: false,
    inBot: false,
    timezone: undefined,
  });
  const { model, seen } = scriptedModel([]);
  await answerWith(model, { skills, loaded: ["writing"] }).generate({ prompt: "shorter" });
  expect(systemTexts(seen[0])?.at(-1)).toContain("<rewrites>");
});

test("the user's own skills join the skill index with the first sentence as when, and a built-in name wins", () => {
  const skills = skillsFor({
    mode: "quick",
    texting: true,
    inBot: false,
    timezone: undefined,
    canWriteSkills: true,
    offered: {},
    plugins: {},
    userSkills: [
      {
        name: "Hadith format",
        instructions: "Use this when the user asks for a hadith. Give the Arabic, then the grade.",
      },
      { name: "Skill_Authoring", instructions: "Pretend to be the built-in one." },
    ],
  });
  expect(skillIndex(skills)).toContain(
    "- Hadith format: Use this when the user asks for a hadith.",
  );
  expect(skills.filter(({ name }) => name.toLowerCase() === "skill_authoring")).toHaveLength(1);
  expect(skills.find(({ name }) => name === "skill_authoring")?.tools).toEqual(["update_skill"]);
  expect(loadedText(skills, new Set(["Hadith format"]))).toBe(
    "\n\n## Skill: Hadith format\n\nUse this when the user asks for a hadith. Give the Arabic, then the grade.",
  );
});

test("a chat that cannot save skills has no skill_authoring skill", () => {
  const skills = skillsFor({
    ...noSkills,
    mode: "quick",
    texting: true,
    inBot: false,
    timezone: undefined,
  });
  expect(skills.map(({ name }) => name)).toEqual([]);
});

test("code, file and plugin tools stay closed until their skill loads", async () => {
  const skills = skillsFor({
    ...noSkills,
    mode: "quick",
    texting: false,
    inBot: false,
    timezone: undefined,
    offered: { code_execution: noInput, create_text_file: noInput, search_plugins: noInput },
    plugins: { notion_search: noInput },
  });
  const { model, seen } = scriptedModel(["load_skill"], ["calculate"]);
  await answerWith(model, {
    tools: {
      search_web: noInput,
      load_skill: loadSkill(skills),
      code_execution: noInput,
      create_text_file: noInput,
      search_plugins: noInput,
      notion_search: noInput,
    },
    skills,
    firstStep: undefined,
  }).generate({ prompt: "zakat on 100 g of gold" });
  const [before, after] = seen;
  expect([toolNames(before), toolNames(after)]).toEqual([
    ["search_web", "load_skill"],
    ["search_web", "load_skill", "code_execution"],
  ]);
});
