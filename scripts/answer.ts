import SearchAgent from "../lib/agents/search";
import { getLLM } from "../lib/models";
import { SearchAgentMode } from "../lib/agents/search/types";

const query = process.argv[2];
const mode = (process.argv[3] ?? "balanced") as SearchAgentMode;

if (!query || !["speed", "balanced", "quality"].includes(mode)) {
  console.error('usage: bun run answer "<query>" [speed|balanced|quality]');
  process.exit(1);
}

const agent = new SearchAgent();

const { classification, sources, textStream } = await agent.searchAsync({
  chatHistory: [],
  followUp: query,
  config: {
    llm: getLLM(),
    mode,
    systemInstructions: "None",
  },
  onSubStep: (subStep) => {
    if (subStep.type === "reasoning") {
      console.log(`> ${subStep.reasoning}`);
    } else if (subStep.type === "searching") {
      console.log(`> searching: ${subStep.queries.join(" | ")}`);
    } else if (subStep.type === "reading") {
      console.log(`> reading: ${subStep.urls.join(" | ")}`);
    }
  },
});

if (classification.classification.skipSearch) {
  console.log("> search skipped");
}
console.log();

for await (const chunk of textStream) {
  process.stdout.write(chunk);
}

if (sources.length > 0) {
  console.log("\n\nSources:");
  sources.forEach((s, i) => {
    console.log(`[${i + 1}] ${s.metadata.title} — ${s.metadata.url}`);
  });
}
