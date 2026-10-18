import { median, readPerplexity, readQuestions, readRun } from "./runs";

const names = process.argv.slice(2);
if (names.length === 0) {
  throw new Error("Usage: bun run bench:summary <run name>...");
}

const kinds = new Map(
  (await readQuestions()).map(({ kind, question }) => [question, kind]),
);

console.log(
  "run".padEnd(14),
  "input islamic general tools output first-text total words cites",
);
const runs = await Promise.all(
  names.map(async (name) => ({
    name,
    rows: (await readRun(name)).filter((row) => row.text !== undefined),
  })),
);
for (const { name, rows } of runs) {
  const of = (pick: (row: (typeof rows)[number]) => number | undefined) =>
    median(rows.flatMap((row) => pick(row) ?? []));
  const islamic = rows.filter((row) => row.kind === "islamic");
  const general = rows.filter((row) => row.kind === "general");
  console.log(
    name.padEnd(14),
    of((row) => row.inputTokens),
    median(islamic.flatMap((row) => row.inputTokens ?? [])),
    median(general.flatMap((row) => row.inputTokens ?? [])),
    of((row) => row.toolTokens),
    of((row) => row.outputTokens),
    of((row) => row.firstText),
    of((row) => row.total),
    of((row) => row.words),
    of((row) => row.cites),
  );
}

const perplexity = (await readPerplexity()).flatMap((row) =>
  row.usage ? [{ kind: kinds.get(row.question), usage: row.usage }] : [],
);
console.log(
  "perplexity".padEnd(14),
  median(perplexity.map((row) => row.usage.input_tokens)),
  median(
    perplexity
      .filter((row) => row.kind === "islamic")
      .map((row) => row.usage.input_tokens),
  ),
  median(
    perplexity
      .filter((row) => row.kind === "general")
      .map((row) => row.usage.input_tokens),
  ),
  "-",
  median(perplexity.map((row) => row.usage.output_tokens)),
);

for (const { name, rows } of runs) {
  const sources = rows.flatMap((row) => row.sources ?? []);
  const cited = [...new Set(sources.map((source) => source.kind))].map(
    (kind) => {
      const sent = sources.filter((source) => source.kind === kind);
      const used = sent.filter((source) => source.cited).length;
      return `${kind} ${used}/${sent.length}`;
    },
  );
  console.log(`${name} citations used/sent: ${cited.join(", ")}`);
}
