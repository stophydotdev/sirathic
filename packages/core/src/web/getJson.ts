import type { z } from "zod";

const USER_AGENT = "Sirathic/1.0";

type GetJsonOptions = {
  timeoutMs: number;
  form?: URLSearchParams;
  signal?: AbortSignal;
};

export const getJson = async <Schema extends z.ZodType>(
  url: string,
  schema: Schema,
  { timeoutMs, form, signal }: GetJsonOptions,
): Promise<z.output<Schema>> => {
  const response = await fetch(url, {
    method: form === undefined ? "GET" : "POST",
    body: form,
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal:
      signal === undefined
        ? AbortSignal.timeout(timeoutMs)
        : AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
  });
  if (!response.ok) {
    throw new Error(`${new URL(url).hostname} returned HTTP ${response.status}`);
  }
  return schema.parse(await response.json());
};
