import { parseJsonEventStream, uiMessageChunkSchema } from "ai";

export async function streamFailure(response: Response) {
  let failure: string | undefined;
  await parseJsonEventStream({
    stream: response.body ?? new ReadableStream(),
    schema: uiMessageChunkSchema,
  }).pipeTo(
    new WritableStream({
      write: (chunk) => {
        if (chunk.success && chunk.value.type === "error") failure = chunk.value.errorText;
      },
    }),
  );
  return failure;
}
