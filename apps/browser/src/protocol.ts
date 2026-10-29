import { z } from "zod";

const target = z
  .string()
  .regex(/^(?:f\d+)?e\d+$/u)
  .describe("The element's ref from your latest snapshot, passed bare: f1e12 for [ref=f1e12].");

export const navigateInput = z.object({ url: z.httpUrl() });
export const findInput = z.object({ text: z.string().min(1).max(200) });
export const clickInput = z.object({ target });
export const typeInput = z.object({
  target,
  text: z.string().max(2_000),
  submit: z.boolean().optional().describe("Press Enter after typing."),
});
export const pressInput = z.object({
  key: z.string().min(1).max(40).describe("One key, like Enter, Escape, ArrowDown or Control+A."),
});
export const selectInput = z.object({
  target,
  values: z
    .array(z.string())
    .min(1)
    .describe("Option values or labels to pick in a native <select>."),
});
export const waitForInput = z.object({
  text: z.string().min(1).optional().describe("Wait until this text shows on the page."),
  textGone: z.string().min(1).optional().describe("Wait until this text is gone from the page."),
  time: z
    .number()
    .min(0.1)
    .max(10)
    .optional()
    .describe("Seconds to wait, for a known fixed delay."),
});
export const runCodeInput = z.object({
  code: z
    .string()
    .min(1)
    .max(5_000)
    .describe(
      "A JavaScript expression evaluated in the page, like document.title or an async IIFE. Return JSON-serializable data.",
    ),
});

export const action = z.discriminatedUnion("kind", [
  navigateInput.extend({ kind: z.literal("navigate") }),
  z.object({ kind: z.literal("snapshot") }),
  findInput.extend({ kind: z.literal("find") }),
  clickInput.extend({ kind: z.literal("click") }),
  typeInput.extend({ kind: z.literal("type") }),
  pressInput.extend({ kind: z.literal("press") }),
  selectInput.extend({ kind: z.literal("select") }),
  waitForInput.extend({ kind: z.literal("wait_for") }),
  runCodeInput.extend({ kind: z.literal("run_code") }),
]);

export type Action = z.infer<typeof action>;

export const request = z.object({
  session: z.string().min(1).max(100),
  action,
});

export const result = z.object({
  url: z.string(),
  title: z.string(),
  page: z.string(),
});

export type Result = z.infer<typeof result>;

export const failure = z.object({ error: z.string() });
