import { streamText } from "ai";
import { getWriterPrompt } from "@sirathic/core/prompts/search/writer";
import SessionManager from "@sirathic/core/session";
import { Chunk, ResearchBlock, TextBlock } from "@sirathic/core/types";
import { classify } from "./classifier";
import Researcher from "./researcher";
import { SearchAgentInput } from "./types";

class SearchAgent {
  async searchAsync(session: SessionManager, input: SearchAgentInput) {
    try {
      const classification = await classify({
        chatHistory: input.chatHistory,
        query: input.followUp,
        llm: input.config.llm,
      });

      let searchFindings: Chunk[] = [];
      let finalContext =
        "<Query to be answered without searching; Search not made; Answer directly from your general knowledge without citations; The 'no relevant information' fallback does not apply here>";

      if (classification.classification.haramAssistance) {
        finalContext =
          "<The user's request seeks active assistance with something impermissible in Islam; No search was made and none will be; Follow the Values Alignment instructions: decline gently, briefly explain why in light of Islamic teachings, and offer a beneficial halal alternative; Do not use citations; The 'no relevant information' fallback does not apply here>";
      } else if (!classification.classification.skipSearch) {
        const researchBlockId = crypto.randomUUID();

        session.emitBlock({
          id: researchBlockId,
          type: "research",
          data: {
            subSteps: [],
          },
        });

        const researcher = new Researcher();

        const researchResults = await researcher.research({
          chatHistory: input.chatHistory,
          followUp: input.followUp,
          classification,
          config: input.config,
          onSubStep: (subStep) => {
            const block = session.getBlock(researchBlockId) as
              | ResearchBlock
              | undefined;

            if (!block) return;

            block.data.subSteps.push({
              id: crypto.randomUUID(),
              ...subStep,
            });

            session.updateBlock(researchBlockId, [
              {
                op: "replace",
                path: "/data/subSteps",
                value: block.data.subSteps,
              },
            ]);
          },
        });

        searchFindings = researchResults.searchFindings;

        session.emitBlock({
          id: crypto.randomUUID(),
          type: "source",
          data: searchFindings,
        });

        finalContext = searchFindings
          .map(
            (f, index) =>
              `<result index=${index + 1} title=${f.metadata.title}>${f.content}</result>`,
          )
          .join("\n");
      }

      session.emit("data", {
        type: "researchComplete",
      });

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

      let responseBlockId = "";

      for await (const chunk of answerStream.textStream) {
        if (!responseBlockId) {
          const block: TextBlock = {
            id: crypto.randomUUID(),
            type: "text",
            data: chunk,
          };

          session.emitBlock(block);

          responseBlockId = block.id;
        } else {
          const block = session.getBlock(responseBlockId) as TextBlock | null;

          if (!block) {
            continue;
          }

          block.data += chunk;

          session.updateBlock(block.id, [
            {
              op: "replace",
              path: "/data",
              value: block.data,
            },
          ]);
        }
      }

      session.emit("end", {});
    } catch (err) {
      console.error("Search agent error:", err);
      session.emit("error", {
        data: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
}

export default SearchAgent;
