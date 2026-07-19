import { z } from "zod";
import generateSuggestions from "@/lib/agents/suggestions";
import { getLLM } from "@/lib/models";
import { ChatTurnMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  chatHistory: z.array(z.tuple([z.enum(["human", "assistant"]), z.string()])),
  model: z.string().optional(),
});

export const POST = async (req: Request) => {
  try {
    const parseBody = bodySchema.safeParse(await req.json());

    if (!parseBody.success) {
      return Response.json(
        {
          message: "Invalid request body",
          error: parseBody.error.issues.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }

    const body = parseBody.data;

    const chatHistory: ChatTurnMessage[] = body.chatHistory.map(
      ([role, content]) => ({
        role: role === "human" ? "user" : "assistant",
        content,
      }),
    );

    const suggestions = await generateSuggestions({ chatHistory }, getLLM(body.model));

    return Response.json({ suggestions }, { status: 200 });
  } catch (err) {
    console.error(`An error occurred while generating suggestions: ${err}`);
    return Response.json(
      { message: "An error occurred while generating suggestions" },
      { status: 500 },
    );
  }
};
