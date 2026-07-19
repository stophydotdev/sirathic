import SearchAgent from "../lib/agents/search";
import SessionManager from "../lib/session";
import { getLLM } from "../lib/models";
import { SearchAgentMode } from "../lib/agents/search/types";
import { Chunk, ResearchSubStep } from "../lib/types";

const query = process.argv[2];
const mode = (process.argv[3] ?? "balanced") as SearchAgentMode;

if (!query || !["speed", "balanced", "quality"].includes(mode)) {
  console.error('usage: bun run answer "<query>" [speed|balanced|quality]');
  process.exit(1);
}

const session = SessionManager.createSession();
const agent = new SearchAgent();

let printedText = 0;
const printedSubSteps = new Set<string>();
let sources: Chunk[] = [];

const printSubStep = (subStep: ResearchSubStep) => {
  if (printedSubSteps.has(subStep.id)) return;
  printedSubSteps.add(subStep.id);

  if (subStep.type === "reasoning") {
    console.log(`> ${subStep.reasoning}`);
  } else if (subStep.type === "searching") {
    console.log(`> searching: ${subStep.queries.join(" | ")}`);
  } else if (subStep.type === "reading") {
    console.log(`> reading: ${subStep.urls.join(" | ")}`);
  }
};

const finished = new Promise<void>((resolve) => {
  session.subscribe((event, data) => {
    if (event === "data") {
      if (data.type === "block") {
        if (data.block.type === "text") {
          process.stdout.write(data.block.data);
          printedText = data.block.data.length;
        } else if (data.block.type === "source") {
          sources = data.block.data;
        } else if (data.block.type === "research") {
          data.block.data.subSteps.forEach(printSubStep);
        }
      } else if (data.type === "updateBlock") {
        const block = session.getBlock(data.blockId);

        if (block?.type === "text") {
          process.stdout.write(block.data.slice(printedText));
          printedText = block.data.length;
        } else if (block?.type === "research") {
          block.data.subSteps.forEach(printSubStep);
        }
      } else if (data.type === "researchComplete") {
        console.log();
      }
    } else if (event === "end") {
      resolve();
    } else if (event === "error") {
      console.error("error:", data.data);
      resolve();
    }
  });
});

agent.searchAsync(session, {
  chatHistory: [],
  followUp: query,
  config: {
    llm: getLLM(),
    mode,
    systemInstructions: "None",
  },
});

await finished;

if (sources.length > 0) {
  console.log("\n\nSources:");
  sources.forEach((s, i) => {
    console.log(`[${i + 1}] ${s.metadata.title} — ${s.metadata.url}`);
  });
}
