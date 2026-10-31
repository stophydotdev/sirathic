import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { isStepCount, Output, streamText, ToolLoopAgent } from "ai";
import { z } from "zod";
import { yesChances } from "../apps/server/src/chat/clef";
import { withoutEmDashes } from "../apps/server/src/chat/compact";
import { instructions } from "../apps/server/src/chat/prompts/build";
import { sirathicTools } from "../apps/server/src/chat/tools";
import { DEFAULT_NOOR, NOOR_SIDE_MODEL, noorModel } from "../apps/server/src/models/noor";
import { DEFAULT_SETTINGS } from "../apps/server/src/shared/settings";
import { type Source, source } from "../apps/server/src/shared/sources";
import { queue } from "../apps/web/src/content/discover/queue";
import { article, type ArticleInput } from "../apps/web/src/content/discover/schema";

const FOLDER = join(import.meta.dir, "../apps/web/src/content/discover");
const TINTS = ["teal", "rose", "amber", "indigo"] as const;
const STEP_CAP = 20;
const RESEARCH_MS = 15 * 60_000;
const PASS = 0.5;

const ARTICLE_RULES = `You turn a cited answer into a Discover article. Use only the answer's own statements and keep their meaning. Never add a fact, a source, a grade or a name the answer does not have.

Return:
- summary: two or three sentences that give each school's answer, with the citation numbers the answer uses for them.
- sections: use these headings in this order, and leave out any the answer has nothing for: What the Quran says; What the hadith show; How the four schools rule; How scholars reconciled the evidence; What recent fatwas say.
- Each paragraph is two to four plain sentences. Its citations are the numbers in square brackets that the answer uses for those statements. Remove the brackets from the text.
- Never say or suggest that one school is right or wrong, or that one side wins.`;

const FIX = `Rewrite the paragraph using only what the sources say. Drop every statement the sources do not support. Never state a hadith grade or a grader the sources do not show. Keep it plain, two to four sentences. Return an empty text if nothing in the paragraph is supported.`;

const REVIEW = {
  supported: "Is every statement in the paragraph supported by the sources?",
  grade: "Does the paragraph give a hadith grade, or name a grader, that none of the sources show?",
};

const BATTLE = {
  battle: "Does the article say or suggest that one school is wrong, or that one side wins?",
};

const paragraph = z.object({ text: z.string(), citations: z.array(z.number().int()) });
const drafted = z.object({
  summary: paragraph,
  sections: z.array(z.object({ heading: z.string(), paragraphs: z.array(paragraph) })),
});
const fixed = z.object({ text: z.string() });
const withSources = z.object({ sources: z.array(source) });
const shown = z.looseObject({ citation: z.number().nullable().optional() });
const shownResults = z.union([
  z
    .object({ results: z.record(z.string(), z.array(shown)) })
    .transform((output) => Object.values(output.results).flat()),
  z.object({ pages: z.array(shown) }).transform((output) => output.pages),
  z.object({ verses: z.array(shown) }).transform((output) => output.verses),
]);

type Paragraph = ArticleInput["summary"];

const brief = (title: string) =>
  `${title} Give: the Quran verses involved and how the Companions and scholars read them; the hadith with their grades; the position of each of the four madhabs from their own fiqh books, searching each school's books separately in Arabic; recent fatwas; and where the evidence seems to conflict, how the scholars reconciled it. Do not say which school is right. Cite every point.`;

const inOrder = <Item, Done>(
  items: readonly Item[],
  work: (item: Item, at: number) => Promise<Done>,
) =>
  items.reduce<Promise<Done[]>>(
    (before, item, at) => before.then(async (done) => [...done, await work(item, at)]),
    Promise.resolve([]),
  );

const camelOf = (slug: string) =>
  slug.replaceAll(/-([a-z0-9])/gu, (_whole, letter: string) => letter.toUpperCase());

async function research(title: string) {
  const urls: string[] = [];
  const cite = (url: string) => {
    const at = urls.indexOf(url);
    if (at >= 0) return at + 1;
    urls.push(url);
    return urls.length;
  };
  const tools = sirathicTools(cite, ["quran", "hadith", "fatwa", "book"]);
  const model = noorModel(DEFAULT_NOOR);
  if (!model) throw new Error("Noor is not set up");
  const agent = new ToolLoopAgent({
    model,
    instructions: instructions({
      now: new Date(),
      timezone: undefined,
      mode: "research",
      settings: DEFAULT_SETTINGS,
      short: false,
      project: undefined,
      unattended: true,
      offered: tools,
      skills: [],
      remembers: false,
      connectedApps: [],
      toolNotes: [],
    }),
    tools,
    stopWhen: isStepCount(STEP_CAP),
    prepareStep: ({ stepNumber }) =>
      stepNumber === STEP_CAP - 1 ? { toolChoice: "none" as const } : {},
  });
  const result = await agent.generate({
    prompt: brief(title),
    abortSignal: AbortSignal.timeout(RESEARCH_MS),
  });
  const read = new Map<string, Source>();
  const seen = new Map<string, string>();
  for (const step of result.steps) {
    for (const call of step.toolResults) {
      for (const found of withSources.safeParse(call.output).data?.sources ?? []) {
        read.set(found.url, found);
      }
      for (const { citation, ...rest } of shownResults.safeParse(call.output).data ?? []) {
        const url = citation ? urls[citation - 1] : undefined;
        if (url) seen.set(url, JSON.stringify(rest));
      }
    }
  }
  return {
    text: result.text,
    urlOf: (number: number) => urls[number - 1],
    read,
    seen,
    steps: result.steps.length,
    inputTokens: result.totalUsage.inputTokens ?? 0,
  };
}

async function review(
  draft: Paragraph,
  seen: Map<string, string>,
  log: (line: string) => void,
): Promise<Paragraph | undefined> {
  const sources = Object.fromEntries(
    draft.citations.flatMap((url, at) => {
      const text = seen.get(url);
      return text ? [[`source ${at + 1}`, text]] : [];
    }),
  );
  const check = async (text: string) => {
    const chance = await yesChances({ paragraph: text, sources }, REVIEW, "clef");
    const supported = chance("supported") ?? 0;
    const grade = chance("grade") ?? 1;
    return { supported, grade, passed: supported >= PASS && grade < PASS };
  };
  const first = await check(draft.text);
  const scores = `supported ${first.supported.toFixed(2)}, bad grade ${first.grade.toFixed(2)}`;
  if (first.passed) {
    log(`  pass (${scores})`);
    return draft;
  }
  const { text } = await streamText({
    model: NOOR_SIDE_MODEL,
    instructions: FIX,
    prompt: JSON.stringify({ paragraph: draft.text, sources }),
    output: Output.object({ schema: fixed }),
  }).output;
  const rewritten = withoutEmDashes(text).trim();
  if (!rewritten) {
    log(`  dropped, nothing supported (${scores})`);
    return undefined;
  }
  const second = await check(rewritten);
  log(
    `  ${second.passed ? "fixed" : "dropped"} (${scores}; after fix supported ${second.supported.toFixed(2)}, bad grade ${second.grade.toFixed(2)})`,
  );
  return second.passed ? { ...draft, text: rewritten } : undefined;
}

async function write(entry: (typeof queue)[number], tint: (typeof TINTS)[number]) {
  const startedAt = performance.now();
  const log = (line: string) => console.log(`[${entry.slug}] ${line}`);
  const found = await research(entry.title);
  log(
    `researched in ${Math.round((performance.now() - startedAt) / 1000)} s, ${found.steps} steps, ${found.inputTokens} input tokens, ${found.seen.size} sources read, answer ${found.text.length} chars`,
  );
  const draft = await streamText({
    model: NOOR_SIDE_MODEL,
    instructions: ARTICLE_RULES,
    prompt: found.text,
    output: Output.object({ schema: drafted }),
  }).output;
  const linked = ({ text, citations }: z.infer<typeof paragraph>): Paragraph => ({
    text: withoutEmDashes(text).trim(),
    citations: [...new Set(citations.flatMap((number) => found.urlOf(number) ?? []))].filter(
      (url) => found.seen.has(url),
    ),
  });
  const reviewed = async (entered: z.infer<typeof paragraph>) => {
    const ready = linked(entered);
    if (ready.citations.length === 0) {
      log("  dropped, no source it cites was read");
      return undefined;
    }
    return review(ready, found.seen, log);
  };
  if (!found.text.trim()) return log("FAILED: research gave no answer");
  log("summary");
  const summary = await reviewed(draft.summary);
  if (!summary) return log("FAILED: the summary did not pass review");
  const checked = await inOrder(draft.sections, async (section) => {
    log(section.heading);
    const kept = await Promise.all(section.paragraphs.map(reviewed));
    return {
      heading: section.heading,
      paragraphs: kept.flatMap((passed) => (passed ? [passed] : [])),
    };
  });
  const sections = checked.filter((section) => section.paragraphs.length > 0);
  if (sections.length === 0) return log("FAILED: no section passed review");
  const whole = [summary, ...sections.flatMap((section) => section.paragraphs)]
    .map((part) => part.text)
    .join("\n\n");
  const battle = (await yesChances(whole, BATTLE, "clef"))("battle") ?? 1;
  if (battle >= PASS) return log(`FAILED: reads as one side winning (${battle.toFixed(2)})`);
  const cited = new Set(
    [summary, ...sections.flatMap((section) => section.paragraphs)].flatMap(
      (part) => part.citations,
    ),
  );
  const input = {
    title: entry.title,
    slug: entry.slug,
    topic: entry.topic,
    tint,
    summary,
    updated: new Date().toISOString().slice(0, 10),
    reviewed: false,
    sources: [...cited].flatMap((url) => {
      const read = found.read.get(url);
      return read ? [{ url, title: read.title }] : [];
    }),
    sections,
    related: [],
  } satisfies ArticleInput;
  const parsed = article.safeParse(input);
  if (!parsed.success) return log(`FAILED: ${parsed.error.message}`);
  await Bun.write(
    join(FOLDER, `${camelOf(entry.slug)}.ts`),
    `import type { ArticleInput } from "./schema";\n\nexport default ${JSON.stringify(input, null, 2)} satisfies ArticleInput;\n`,
  );
  log(
    `WRITTEN: ${sections.length} sections, ${cited.size} sources, battle ${battle.toFixed(2)}, ${Math.round((performance.now() - startedAt) / 1000)} s`,
  );
}

const present = new Set(await readdir(FOLDER));
const waiting = queue
  .filter((entry) => !present.has(`${camelOf(entry.slug)}.ts`))
  .slice(0, Number(Bun.argv[2] ?? queue.length));
await inOrder(waiting, (entry, at) =>
  write(entry, TINTS[at % TINTS.length] ?? "teal").catch((err: Error) =>
    console.log(`[${entry.slug}] FAILED: ${err.message}`),
  ),
);
const done = new Set(await readdir(FOLDER));
const written = queue.map((entry) => camelOf(entry.slug)).filter((name) => done.has(`${name}.ts`));
await Bun.write(
  join(FOLDER, "written.ts"),
  `${written.map((name) => `import ${name} from "./${name}";`).join("\n")}\n\nexport const written = [${written.join(", ")}];\n`,
);
process.exit(0);
