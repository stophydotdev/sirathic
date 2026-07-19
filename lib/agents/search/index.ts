import { streamText } from "ai";
import { getWriterPrompt } from "@/lib/prompts/search/writer";
import { Chunk } from "@/lib/types";
import { classify } from "./classifier";
import Researcher from "./researcher";
import { SearchAgentInput, SearchAgentOutput } from "./types";

class SearchAgent {
  async searchAsync(input: SearchAgentInput): Promise<SearchAgentOutput> {
    const classification = await classify({
      chatHistory: input.chatHistory,
      query: input.followUp,
      llm: input.config.llm,
    });

    let searchFindings: Chunk[] = [];
    let finalContext =
      "<Query to be answered without searching; Search not made>";

    if (!classification.classification.skipSearch) {
      const researcher = new Researcher();

      const researchResults = await researcher.research({
        chatHistory: input.chatHistory,
        followUp: input.followUp,
        classification,
        config: input.config,
        onSubStep: input.onSubStep,
      });

      searchFindings = researchResults.searchFindings;

      finalContext = searchFindings
        .map(
          (f, index) =>
            `<result index=${index + 1} title=${f.metadata.title}>${f.content}</result>`,
        )
        .join("\n");
    }

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
      classification,
      sources: searchFindings,
      textStream: answerStream.textStream,
    };
  }
}

export default SearchAgent;
