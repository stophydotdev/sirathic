import { mkdir } from "node:fs/promises";
import { z } from "zod";
import { db } from "@sirathic/db";
import { users } from "@sirathic/db/schema";
import { eq } from "drizzle-orm";
import { citations } from "../src/chat/citations";
import {
  answerOptions,
  chatModel,
  DEFAULT_MODEL,
  type ProviderOptions,
} from "../src/chatgpt/codex";
import { answerRules } from "../src/chat/prompt";
import { answerAgent } from "../src/chat/response";
import { CORE_TOOLS, sirathicTools } from "../src/chat/tools";
import { DEFAULT_SETTINGS } from "../src/shared/settings";
import { readQuestions, readRun, RUNS, type RunRow } from "./runs";

const AT_ONCE = 4;
const KINDS = ["quran", "hadith", "fatwa", "fiqh", "web", "news"] as const;

const numbered = z.array(
  z.object({
    citation: z.number().nullish(),
    ref: z.string().optional(),
    work: z.string().optional(),
    school: z.string().optional(),
    title: z.string().optional(),
    url: z.string().optional(),
  }),
);

const labelOf = (entry: z.infer<typeof numbered>[number]) =>
  `[${entry.citation ?? "-"}] ${entry.ref ?? (entry.work ? `${entry.school}: ${entry.work}` : (entry.title ?? entry.url ?? ""))}`;
const searched = z.object({
  results: z.object({
    quran: numbered.optional(),
    hadith: numbered.optional(),
    fatwa: numbered.optional(),
    fiqh: numbered.optional(),
    web: numbered.optional(),
    news: numbered.optional(),
  }),
});
const checkedMatches = z.object({
  matches: z.array(z.object({ citation: z.number().nullable() })),
});
const toolTokens = z.object({
  attribution: z.object({
    request_fields: z.object({
      tools: z.object({ input_tokens: z.number() }),
    }),
  }),
});

const [name, set] = process.argv.slice(2);
if (!name) {
  throw new Error(
    "Usage: bun run bench <run name> [fiqhqa | reddit | quote | original]",
  );
}
const VARIANTS = {
  concise: [
    ["three or four sections", "two or three sections"],
    ["Aim for 450 to 650 words", "Aim for 250 to 400 words"],
  ],
  schools: [
    [
      "but only from a source in front of you.",
      "but only from a source in front of you. Fiqh books often record several opinions inside one school; give the one the book marks as the school's position, such as المذهب, الصحيح, المعتمد or ظاهر الرواية, and present the others as other opinions within the school.",
    ],
  ],
  brief: [
    ["three or four sections", "one or two sections"],
    ["Aim for 450 to 650 words", "Aim for 150 to 250 words"],
  ],
  noleak: [
    [
      "Never mention your searches, tools, or results; just answer.",
      "Never mention your searches, tools, or results, and never leave notes to yourself in the answer; just answer.",
    ],
  ],
} satisfies Record<string, [string, string][]>;

const variant = Bun.env.BENCH_VARIANT;
const edits = (variant?.split(",") ?? []).flatMap((part) => {
  const found = Object.entries(VARIANTS).find(([key]) => key === part)?.[1];
  if (found === undefined) throw new Error(`Unknown BENCH_VARIANT ${part}`);
  return found;
});

const rulesFor = (question: string) =>
  edits.reduce(
    (rules, [from, to]) => {
      if (!rules.includes(from)) {
        throw new Error(
          `BENCH_VARIANT ${variant}: "${from}" is not in the rules`,
        );
      }
      return rules.replace(from, to);
    },
    answerRules(DEFAULT_SETTINGS, question),
  );

const effort = z
  .enum(["low", "medium", "high"])
  .optional()
  .parse(Bun.env.BENCH_EFFORT);

const withEffort = (options: ProviderOptions) =>
  effort === undefined
    ? options
    : { ...options, openai: { ...options.openai, reasoningEffort: effort } };

const benchUser = z.email().parse(Bun.env.BENCH_USER);
const [user] = await db
  .select({
    id: users.id,
    email: users.email,
    image: users.image,
    plan: users.plan,
    accountId: users.accountId,
  })
  .from(users)
  .where(eq(users.email, benchUser));
if (!user?.accountId) {
  throw new Error(`nobody has signed in with ChatGPT as ${benchUser}`);
}
const modelName = Bun.env.BENCH_MODEL ?? DEFAULT_MODEL;
const model = chatModel(
  { via: "chatgpt", ...user, accountId: user.accountId },
  modelName,
);

const TAFSIR_CHARS = z.coerce
  .number()
  .int()
  .positive()
  .optional()
  .parse(Bun.env.BENCH_TAFSIR_CHARS);

const withShortTafsir = (text: string) =>
  TAFSIR_CHARS === undefined
    ? text
    : text.replaceAll(/^Tafsir: (.*)$/gmu, (line, body: string) =>
        body.length > TAFSIR_CHARS
          ? `Tafsir: ${body.slice(0, TAFSIR_CHARS)}…`
          : line,
      );

const benchTools = (tools: ReturnType<typeof sirathicTools>) =>
  TAFSIR_CHARS !== undefined
    ? {
        ...tools,
        search: {
          ...tools.search,
          toModelOutput: ({ output }: { output: { text: string } }) => ({
            type: "text" as const,
            value: withShortTafsir(output.text) || "No results.",
          }),
        },
      }
    : tools;

const answer = async (kind: RunRow["kind"], question: string) => {
  const sources = citations([]);
  const tools = benchTools(sirathicTools(sources.add));
  const started = performance.now();
  const at = () => Math.round(performance.now() - started) / 1000;
  const agent = answerAgent({
    model,
    modelName,
    tools,
    mode: "quick",
    settings: DEFAULT_SETTINGS,
    rules: rulesFor(question),
    mustSearch: true,
    started: CORE_TOOLS,
    shorten: (message) => message,
    answerOptions: withEffort(
      answerOptions({
        research: false,
        sessionId: crypto.randomUUID(),
      }),
    ),
  });
  const calls: string[] = [];
  const searchInputs = new Map<string, unknown>();
  const searchLog: { input: unknown; found: Record<string, string[]> }[] = [];
  const searches: z.infer<typeof searched>[] = [];
  const checks: z.infer<typeof checkedMatches>[] = [];
  const streamErrors: string[] = [];
  let text = "";
  let searchSeconds: number | undefined;
  let firstText: number | undefined;
  let usage = { inputTokens: 0, outputTokens: 0, toolTokens: 0 };
  const result = await agent.stream({
    messages: [{ role: "user", content: question }],
    experimental_transform: sources.transform(),
  });
  for await (const part of result.fullStream) {
    if (part.type === "tool-call") {
      calls.push(part.toolName);
      if (part.toolName === "search") {
        searchInputs.set(part.toolCallId, part.input);
      }
    }
    if (part.type === "tool-result" && part.toolName === "search") {
      searchSeconds ??= at();
      const output = searched.parse(part.output);
      searches.push(output);
      searchLog.push({
        input: searchInputs.get(part.toolCallId),
        found: Object.fromEntries(
          KINDS.map((source) => [
            source,
            (output.results[source] ?? []).map(labelOf),
          ]),
        ),
      });
    }
    if (part.type === "tool-result" && part.toolName === "hadithCheck") {
      checks.push(checkedMatches.parse(part.output));
    }
    if (part.type === "text-delta") {
      firstText ??= at();
      text += part.text;
    }
    if (part.type === "error") streamErrors.push(String(part.error));
    if (part.type === "finish") {
      usage = {
        inputTokens: part.totalUsage.inputTokens ?? 0,
        outputTokens: part.totalUsage.outputTokens ?? 0,
        toolTokens:
          toolTokens.safeParse(part.totalUsage.raw).data?.attribution
            .request_fields.tools.input_tokens ?? 0,
      };
    }
  }
  if (!text.trim()) {
    throw new Error(`no answer text: ${streamErrors.join("; ") || "empty"}`);
  }
  const cited = new Set(
    [...text.matchAll(/\[(\d+)\]/gu)].map((match) => Number(match[1])),
  );
  const listed = [
    ...searches.flatMap((output) =>
      KINDS.flatMap((source) =>
        (output.results[source] ?? []).map((entry, rank) => ({
          kind: source,
          rank,
          number: entry.citation,
        })),
      ),
    ),
    ...checks.flatMap((output) =>
      output.matches.map((match, rank) => ({
        kind: "hadithCheck",
        rank,
        number: match.citation,
      })),
    ),
  ];
  return {
    kind,
    question,
    searchSeconds,
    firstText,
    total: at(),
    calls,
    searches: searchLog,
    ...usage,
    words: text.split(/\s+/u).filter(Boolean).length,
    cites: cited.size,
    links: [
      ...new Map(
        [...text.matchAll(/\[(\d+)\]\(([^)\s]+)\)/gu)].map(
          ([, number, url]) => [Number(number), url],
        ),
      ),
    ].map(([number, url]) => ({ number, url })),
    sources: listed.flatMap((entry) =>
      entry.number == null
        ? []
        : [
            {
              kind: entry.kind,
              rank: entry.rank,
              number: entry.number,
              cited: cited.has(entry.number),
            },
          ],
    ),
    text,
  };
};

const file = `${RUNS}/${name}.json`;
await mkdir(RUNS, { recursive: true });
const questions = await readQuestions();
const rows = new Map(
  ((await Bun.file(file).exists()) ? await readRun(name) : []).map((row) => [
    row.question,
    row,
  ]),
);
const queue = questions.filter(
  (entry) =>
    (!set || (entry.set ?? "original") === set) &&
    !rows.get(entry.question)?.text?.trim(),
);
let saving = Promise.resolve(0);
const save = () => {
  saving = saving.then(() =>
    Bun.write(
      file,
      JSON.stringify(
        questions.flatMap(({ question }) => rows.get(question) ?? []),
        null,
        1,
      ),
    ),
  );
  return saving;
};

const work = async (): Promise<void> => {
  const next = queue.shift();
  if (next === undefined) return;
  const row: RunRow = await answer(next.kind, next.question).catch(
    (error: Error) => ({
      kind: next.kind,
      question: next.question,
      error: error.message,
    }),
  );
  rows.set(next.question, row);
  await save();
  console.log(
    row.error === undefined
      ? `${next.question.slice(0, 40).padEnd(40)} search ${row.searchSeconds}s, first text ${row.firstText}s, total ${row.total}s, ${row.words} words, ${row.cites} cited, ${row.inputTokens} input tokens`
      : `${next.question.slice(0, 40).padEnd(40)} FAILED ${row.error}`,
  );
  return work();
};

console.log(`answering ${queue.length} questions, ${AT_ONCE} at a time`);
await Promise.all(Array.from({ length: AT_ONCE }, work));
console.log(`saved ${rows.size} answers to ${file}`);
process.exit(0);
