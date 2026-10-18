import { z } from "zod";

type ApiError = { error: string };

export class StatusError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 429 | 502,
    message: string,
  ) {
    super(message);
  }
}

export async function respond<Result>(run: () => Promise<Result>) {
  try {
    const result = await run();
    return result instanceof Response ? result : Response.json(result);
  } catch (err) {
    const status = err instanceof StatusError ? err.status : 502;
    return Response.json(
      {
        error: err instanceof Error ? err.message : String(err),
      } satisfies ApiError,
      { status },
    );
  }
}

export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
) {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success)
    throw new StatusError(400, z.prettifyError(parsed.error));
  return parsed.data;
}
