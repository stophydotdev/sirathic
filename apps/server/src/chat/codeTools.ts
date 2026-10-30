import { env } from "@sirathic/env/server";
import { z } from "zod";
import type { BotDisk } from "../bots/disk";

export const CODE_RULES = `Using the code_execution tool:
- Use code_execution for meaningful computational work that requires actual calculation, data processing or analysis that you cannot perform directly in your thinking process. Any zakat, inheritance, nisab, hijri date or unit conversion that combines two or more figures counts, even when it looks easy.
- Do NOT use code_execution for: simple arithmetic, basic data display, printing raw data without processing, or tasks that can be accomplished with plain text responses.
- Do NOT make dummy tool calls, test calls, or calls that don't accomplish meaningful computational work toward the answer.
- Code output (stdout/stderr) is only visible to you, not the user. Do not use print statements to "present" or "display" information; the user will never see it. Only run code that produces artifacts (files) or computes values you need for your analysis. Put every number you rely on in your answer in plain words and digits. The interface does not render LaTeX.
- Call code_execution with the complete python script as the input that is ready for immediate execution.
- Internet access for the execution environment is disabled. Do NOT make external web requests or API calls as they will fail. Pass it the figures you already have.
- Minimize comments in the code, only write essential comments that guide your core logic.`;

const RUN_MS = 120_000;

const sent = z.object({ name: z.string(), data: z.base64() });

const ran = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number(),
  files: z.array(sent),
  changed: z.array(sent),
  removed: z.array(z.string()),
});

const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

export const codeSandbox = (session: string, disk?: BotDisk) => {
  let queue: Promise<unknown> = Promise.resolve();
  const runAlone = async (code: string, abortSignal: AbortSignal | undefined) => {
    const sending = disk
      ? await Promise.all(
          (await disk.list()).map(async ({ name }) => ({
            name,
            data: base64(await disk.read(name)),
          })),
        )
      : [];
    const response = await fetch(`${env.SANDBOX_URL}/run`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.SANDBOX_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ session, code, files: sending }),
      signal: AbortSignal.any([AbortSignal.timeout(RUN_MS), ...(abortSignal ? [abortSignal] : [])]),
    });
    if (!response.ok) throw new Error(`The sandbox answered ${response.status}.`);
    const { files, changed, removed, ...output } = ran.parse(await response.json());
    if (disk) await Promise.all(removed.map((name) => disk.remove(name)));
    return {
      ...output,
      files: files.map(({ name, data }) => ({ name, bytes: Buffer.from(data, "base64") })),
      kept: disk
        ? await Promise.all(
            changed.map(({ name, data }) => disk.write(name, Buffer.from(data, "base64"))),
          )
        : [],
      removed: disk ? removed : [],
    };
  };
  return (code: string, abortSignal: AbortSignal | undefined) => {
    const next = queue.then(() => runAlone(code, abortSignal));
    queue = next.catch(() => undefined);
    return next;
  };
};
