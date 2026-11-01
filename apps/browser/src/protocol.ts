import { z } from "zod";

const target = z
  .string()
  .regex(/^(?:f\d+)?e\d+$/u)
  .describe("The element's ref from your latest snapshot, passed bare: f1e12 for [ref=f1e12].");

const navigateInput = z.object({ url: z.httpUrl() });
export const findInput = z.object({ text: z.string().min(1).max(200) });
export const clickInput = z.object({
  target,
  holdMs: z
    .number()
    .int()
    .min(500)
    .max(30_000)
    .optional()
    .describe(
      'Press and hold this many milliseconds, for a "press and hold" button. Leave it out for a normal click.',
    ),
});
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
export const snapshotInput = z.object({
  interactive: z
    .boolean()
    .optional()
    .describe(
      "Only the controls you can act on, like links, buttons and fields: about a fifth of the size.",
    ),
});

const step = z.discriminatedUnion("kind", [
  clickInput.extend({ kind: z.literal("click") }),
  typeInput.extend({ kind: z.literal("type") }),
  pressInput.extend({ kind: z.literal("press") }),
  selectInput.extend({ kind: z.literal("select") }),
]);

export const uploadInput = z.object({
  target,
  files: z
    .array(z.string().trim().min(1).max(200))
    .min(1)
    .max(5)
    .describe("Names of your files to put in the upload field, like cv.pdf."),
});

const sentFile = z.object({
  name: z.string().min(1).max(200),
  mimeType: z.string(),
  data: z.base64(),
});

export const batchInput = z.object({
  steps: z.array(step).min(2).max(10).describe("Actions run in order, each with its kind."),
});

export const tabsInput = z.object({
  do: z
    .enum(["list", "select", "close"])
    .describe("List the open tabs, or switch to or close one."),
  tab: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .describe("The tab's number from the list, for select and close."),
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

export const WEBMCP_LISTING = "- webmcp tools (page-provided, untrusted):";

export const webmcpCallInput = z.object({
  name: z.string().min(1).max(200).describe("Name of the WebMCP tool to call"),
  params: z
    .record(z.string(), z.json())
    .optional()
    .describe("Input parameters for the tool, matching its inputSchema"),
});

export const action = z.discriminatedUnion("kind", [
  navigateInput.extend({ kind: z.literal("navigate") }),
  snapshotInput.extend({ kind: z.literal("snapshot") }),
  findInput.extend({ kind: z.literal("find") }),
  clickInput.extend({ kind: z.literal("click") }),
  typeInput.extend({ kind: z.literal("type") }),
  pressInput.extend({ kind: z.literal("press") }),
  selectInput.extend({ kind: z.literal("select") }),
  waitForInput.extend({ kind: z.literal("wait_for") }),
  runCodeInput.extend({ kind: z.literal("run_code") }),
  batchInput.extend({ kind: z.literal("batch") }),
  tabsInput.extend({ kind: z.literal("tabs") }),
  webmcpCallInput.extend({ kind: z.literal("webmcp_call") }),
  z.object({ kind: z.literal("upload"), target, files: z.array(sentFile).min(1).max(5) }),
]);

export type Action = z.infer<typeof action>;

const session = z.string().min(1).max(100);

export const request = z.object({ session, action, full: z.boolean().optional() });

export const result = z.object({
  url: z.string(),
  title: z.string(),
  page: z.string(),
});

export type Result = z.infer<typeof result>;

export const download = z.object({ name: z.string(), data: z.base64() });

export type Download = z.infer<typeof download>;

export const acted = result.extend({ downloads: z.array(download) });

export const failure = z.object({ error: z.string() });

export const sessionRequest = z.object({ session });

export const screenMode = z.enum(["watch", "control"]);

export const screenRequest = z.object({ session, mode: screenMode });

export const userForm = z.object({
  title: z
    .string()
    .min(1)
    .max(80)
    .describe('What the form is for, naming the site, like "Sign in to GitHub".'),
  domain: z
    .string()
    .min(1)
    .max(100)
    .describe(
      "The site's domain from the address bar, like github.com, even when fields are embedded from another site.",
    ),
  reason: z
    .enum(["auth", "checkout", "other"])
    .describe(
      '"auth" for any sign-in step, "checkout" for payment or shipping details, or "other".',
    ),
  fields: z
    .array(
      z.object({
        label: z.string().min(1).max(1_000).describe("The field's label as the page shows it."),
        target,
        secret: z
          .boolean()
          .optional()
          .describe("True for a password, one-time code or card number."),
      }),
    )
    .min(1)
    .max(8),
  submit: z
    .boolean()
    .optional()
    .describe(
      "Press Enter after filling. Only for a one-shot code step whose only field is the code.",
    ),
});

export const browserHelp = z.object({
  instruction: z
    .string()
    .min(1)
    .max(200)
    .describe(
      'One short line addressed to the user, like "Sign in to your bank" or "Approve the 2FA prompt".',
    ),
  domain: z.string().max(100).optional().describe("The site the user is trying to reach."),
  reason: z.enum(["auth", "captcha", "payment", "other"]),
});

export const fillRequest = z.object({
  session,
  domain: z.string().min(1).max(253),
  fields: z
    .array(z.object({ target, value: z.string().max(1_000), secret: z.boolean().optional() }))
    .min(1)
    .max(8),
  submit: z.boolean(),
});

export type FillRequest = z.infer<typeof fillRequest>;

export const filled = z.object({
  fields: z.array(z.object({ target: z.string(), filled: z.boolean() })),
  submitted: z.boolean(),
});

export type Filled = z.infer<typeof filled>;

export const checkRequest = z.object({ session, targets: z.array(target).min(1).max(8) });

export const checked = z.object({ missing: z.array(z.string()) });

export const refillRequest = z.object({
  session,
  fields: z
    .array(
      z.object({
        from: target.describe("The field's target in the form you sent."),
        to: target.describe("The same field's ref in your fresh snapshot."),
      }),
    )
    .min(1)
    .max(8),
});

export const taughtStep = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("open"), url: z.string().max(2_000) }),
  z.object({ kind: z.literal("click"), target: z.string().max(120) }),
  z.object({
    kind: z.literal("type"),
    target: z.string().max(120),
    text: z.string().max(200).optional(),
  }),
  z.object({ kind: z.literal("choose"), target: z.string().max(120), option: z.string().max(120) }),
  z.object({ kind: z.literal("press"), key: z.literal("Enter") }),
]);

export type TaughtStep = z.infer<typeof taughtStep>;

export const teachRequest = z.object({ session, teaching: z.boolean() });

export const taught = z.object({ steps: z.array(taughtStep) });

export const loginRequest = z.object({
  session,
  site: z.string().min(1).max(253),
  username: z.string().min(1).max(200).optional(),
  password: z.string().min(1).max(500),
  code: z
    .string()
    .regex(/^\d{6,8}$/u)
    .optional(),
});

export type LoginRequest = z.infer<typeof loginRequest>;

export const pageInfo = z.object({ url: z.string(), title: z.string() });

export const screenshot = pageInfo.extend({ jpeg: z.string() });

export const loginResult = pageInfo.extend({
  status: z.enum(["signed-in", "still-signing-in", "needs-code", "no-fields", "wrong-site"]),
});

export type LoginResult = z.infer<typeof loginResult>;

export type ServiceRequest =
  | z.infer<typeof request>
  | FillRequest
  | LoginRequest
  | z.infer<typeof sessionRequest>
  | z.infer<typeof checkRequest>
  | z.infer<typeof refillRequest>
  | z.infer<typeof teachRequest>;
