import { dynamicTool } from "ai";
import { expect, test } from "bun:test";
import { z } from "zod";
import { type ChatMessage, sentMessage } from "../apps/server/src/shared/messages";
import { needsApproval, writingTools } from "../apps/server/src/chat/confirm";
import { matchingPlugins } from "../apps/server/src/plugins/tools";
import {
  matchingEndpoints,
  STOPHY_LINK,
  withCitations,
  withoutAiAnswers,
} from "../apps/server/src/chat/stophyTools";
import {
  loadSkill,
  loadedText,
  skillIndex,
  skillsFor,
} from "../apps/server/src/chat/skills/builtIn";
import {
  answerWith,
  chatTurn,
  noInput,
  said,
  scriptedModel,
  systemTexts,
  toolNames,
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
  ]).toEqual([{ type: "required" }, true, { type: "auto" }]);
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

const noSkills = { canWriteSkills: false, userSkills: [], offered: {}, plugins: {} };

test.each([
  ["update_routine", { action: "create" }, false],
  ["update_routine", { action: "edit" }, false],
  ["update_routine", { action: "delete" }, false],
  ["update_routine", { action: "pause" }, false],
  ["update_skill", { action: "delete" }, true],
  ["install_plugin", { id: "googlecalendar" }, false],
  ["search_plugins", { query: "calendar" }, false],
  ["update_skill", { action: "write" }, false],
  ["update_routine", { action: "resume" }, false],
  ["list_routines", {}, false],
  ["slack_send", {}, true],
  ["todoist_add_tasks", { content: "Read Surah Al-Mulk" }, false],
  ["posthog_exec", { command: "call project-get {}" }, false],
  ["posthog_exec", { command: 'call feature-flag-delete {"id":7}' }, false],
  ["googlecalendar_delete_event", { eventId: "e1" }, false],
  ["neon_run_sql", { sql: "select count(*) from users" }, false],
  ["neon_run_sql", { sql: "DROP TABLE users" }, true],
  ["neon_run_sql_transaction", { sql_statements: ["select 1", "DELETE FROM users"] }, true],
  ["custom_sendEmail", { to: "a@b.c" }, true],
  ["custom_manage_mail", { action: "send", to: "a@b.c" }, true],
  ["custom_manage_files", { action: "delete", id: "file-1" }, false],
  ["custom_manage_files", { action: "rename", id: "file-1" }, false],
  ["posthog_exec", { command: `${" ".repeat(90)}call project-destroy {"id":7}` }, true],
])("the %s call %p needs the user's confirmation: %p", (toolName, input, expected) => {
  const writes = new Set([
    "slack_send",
    "todoist_add_tasks",
    "posthog_exec",
    "neon_run_sql",
    "neon_run_sql_transaction",
    "custom_sendEmail",
    "custom_manage_mail",
    "custom_manage_files",
  ]);
    "googlecalendar_delete_event",
  expect(needsApproval({ toolName, input }, writes)).toBe(expected);
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

const plugin = (id: string, connected: boolean) => ({
  id,
  name: id,
  category: "productivity",
  connected,
});

test("with no query the plugin list is the whole catalog, installed first, without custom plugins", () => {
  const listed = matchingPlugins(
    [
      plugin("notion", false),
      plugin("googlecalendar", true),
      plugin("todoist", false),
      plugin("custom-ab12cd34", true),
    ],
    undefined,
  );
  expect(listed.map(({ id, installed }) => [id, installed])).toEqual([
    ["googlecalendar", true],
    ["notion", false],
    ["todoist", false],
  ]);
});

const endpoint = (id: string, summary: string) => ({
  id,
  title: id,
  summary,
  bestWhen: null,
  method: "POST" as const,
  path: `/v1/${id.replaceAll(".", "/")}`,
  credits: 1,
  keyless: false,
  cacheTtlSeconds: 0,
  example: null,
});

test("a Stophy search ranks the rare word first, keeps to a named source, reads any other category as words, and lists the sources when nothing matches", () => {
  const catalog = {
    sources: [
      { id: "google", name: "Google", summary: "Search Google" },
      { id: "youtube", name: "YouTube", summary: "Search videos" },
    ],
    endpoints: [
      endpoint("google.ads.search", "Scrape ads from the Google ads library"),
      endpoint("google.news", "Scrape news from the web"),
      endpoint("google.flights", "Scrape Google Flights results with prices and times"),
      endpoint("youtube.transcript", "Scrape a YouTube video's transcript"),
    ],
  } satisfies Parameters<typeof matchingEndpoints>[0];
  expect([
    matchingEndpoints(catalog, { query: "flights from London to Jeddah" }).endpoints[0]?.id,
    matchingEndpoints(catalog, { category: "YouTube" }).endpoints.map(({ id }) => id),
    matchingEndpoints(catalog, { query: "flights to Jeddah", category: "travel" }).endpoints[0]?.id,
    matchingEndpoints(catalog, { query: "halal restaurants" }),
  ]).toEqual([
    "google.flights",
    ["youtube.transcript"],
    "google.flights",
    { endpoints: [], sources: catalog.sources },
  ]);
});

test("Stophy results get a citation and a source for each page link, not for images", () => {
  const cited: string[] = [];
  const cite = (url: string) => cited.push(url);
  const places = withCitations(
    cite,
    {
      results: [
        {
          name: "Tahin",
          address: "10 Kirkgate, Leeds",
          imageUrl: "https://example.com/tahin.jpg",
          placeUrl: "https://www.google.com/maps?cid=1",
        },
        { name: "No link" },
      ],
    },
    "Google Maps Search",
  );
  const flights = withCitations(
    cite,
    { url: "https://www.google.com/travel/flights/search?tfs=1", results: [{ price: 599 }] },
    "Google Flights",
  );
  const video = withCitations(
    cite,
    { title: "The AI bubble", videoUrl: "https://www.youtube.com/watch?v=MgngwkPAuqQ" },
    "YouTube Transcript",
  );
  expect([places.data, [...places.sources, ...flights.sources, ...video.sources]]).toEqual([
    {
      results: [
        {
          citation: 1,
          name: "Tahin",
          address: "10 Kirkgate, Leeds",
          imageUrl: "https://example.com/tahin.jpg",
          placeUrl: "https://www.google.com/maps?cid=1",
        },
        { name: "No link" },
      ],
    },
    [
      { url: "https://www.google.com/maps?cid=1", title: "Tahin", snippet: "10 Kirkgate, Leeds" },
      {
        url: "https://www.google.com/travel/flights/search?tfs=1",
        title: "Google Flights",
        snippet: "",
      },
      { url: "https://www.youtube.com/watch?v=MgngwkPAuqQ", title: "The AI bubble", snippet: "" },
    ],
  ]);
});

test("Stophy sources of AI answers are left out of the catalog, with their endpoints", () => {
  const found = {
    sources: [
      { id: "google", name: "Google", summary: "Search Google", kind: "site" },
      { id: "askbot", name: "Askbot", summary: "Ask a bot", kind: "aiAnswers" },
    ],
    endpoints: [endpoint("google.flights", "Flights"), endpoint("askbot.answer", "An answer")],
  };
  const kept = withoutAiAnswers(found);
  expect([kept.sources.map(({ id }) => id), kept.endpoints.map(({ id }) => id)]).toEqual([
    ["google"],
    ["google.flights"],
  ]);
});

test("links to the sites the Stophy skill names are known, and other pages are not", () => {
  expect(
    [
      "https://youtu.be/MgngwkPAuqQ",
      "https://www.linkedin.com/jobs/view/1",
      "https://uk.indeed.com/viewjob?jk=1",
      "https://www.ebay.co.uk/itm/1",
      "https://maps.google.com/?cid=1",
      "https://www.google.com/maps/place/Leeds",
      "https://apps.apple.com/app/id1",
      "https://islamqa.info/en/answers/1",
      "https://www.netflix.com/title/1",
    ].map((url) => STOPHY_LINK.test(url)),
  ).toEqual([true, true, true, true, true, true, true, false, false]);
});
