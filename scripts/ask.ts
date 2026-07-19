import { streamText } from "ai";
import { getLLM } from "@sirathic/core/models";

const question = process.argv[2];
const model = process.argv[3];

if (!question) {
  console.error('usage: bun run ask "<question>" [model]');
  process.exit(1);
}

const result = streamText({
  model: getLLM(model),
  prompt: question,
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}

process.stdout.write("\n");
