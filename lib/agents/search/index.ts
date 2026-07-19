import { streamText } from "ai";
import { getWriterPrompt } from "@/lib/prompts/search/writer";
import { webSearch } from "@/lib/webSearch";
import { Chunk } from "@/lib/types";
import { SearchAgentInput, SearchAgentOutput } from "./types";

class SearchAgent {
  async searchAsync(input: SearchAgentInput): Promise<SearchAgentOutput> {
    const results = await webSearch(input.followUp);

    const searchFindings: Chunk[] = results.map((r) => ({
      content: r.description || r.title,
      metadata: {
        title: r.title,
        url: r.url,
      },
    }));

    const finalContext = searchFindings
      .map(
        (f, index) =>
          `<result index=${index + 1} title=${f.metadata.title}>${f.content}</result>`,
      )
      .join("\n");

    const finalContextWrapped = `<search_results note="These are the search results and assistant can cite these">\n${finalContext}\n</search_results>`;

    const writerPrompt = getWriterPrompt(
      finalContextWrapped,
      input.config.systemInstructions,
      input.config.mode,
    );

    const answerStream = streamText({
      model: input.config.llm,
      instructions: writerPrompt,
      messages: [
        ...input.chatHistory,
        {
          role: "user",
          content: input.followUp,
        },
      ],
    });

    return {
      sources: searchFindings,
      textStream: answerStream.textStream,
    };
  }
}

export default SearchAgent;
