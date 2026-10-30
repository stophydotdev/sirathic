import { DurableObject } from "cloudflare:workers";
import { z } from "zod";

interface Env {
  SANDBOX: DurableObjectNamespace<Sandbox>;
  SANDBOX_TOKEN: string;
}

const RUN_SECONDS = "60";
const IDLE_MS = 10 * 60_000;
const OUTPUT_DIR = "/workspace/out";
const TEXT_LIMIT = 20_000;
const CHUNK = 0x8000;

const runRequest = z.object({ session: z.string().min(1).max(100), code: z.string().min(1) });

const decoder = new TextDecoder();

const base64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let text = "";
  for (let start = 0; start < bytes.length; start += CHUNK) {
    text += String.fromCharCode(...bytes.subarray(start, start + CHUNK));
  }
  return btoa(text);
};

export class Sandbox extends DurableObject<Env> {
  private queue: Promise<unknown> = Promise.resolve();

  run(code: string) {
    const next = this.queue.then(() => this.runAlone(code));
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async runAlone(code: string) {
    const { container } = this.ctx;
    if (!container) throw new Error("No container is configured for the sandbox");
    if (!container.running) {
      container.start({ image: container.images.python, enableInternet: false });
      await container.setInactivityTimeout(IDLE_MS);
    }
    const shell = async (command: string[], cwd = "/workspace") =>
      (await container.exec(command, { cwd })).output();
    await shell(["rm", "-rf", OUTPUT_DIR]);
    await shell(["mkdir", "-p", OUTPUT_DIR]);
    const ran = await (
      await container.exec(["timeout", "--kill-after=5", RUN_SECONDS, "python3", "-"], {
        stdin: new Response(code).body ?? undefined,
        cwd: "/workspace",
        env: { OUTPUT_DIR, HOME: "/tmp", MPLCONFIGDIR: "/tmp/matplotlib" },
      })
    ).output();
    const listed = await shell([
      "find",
      OUTPUT_DIR,
      "-maxdepth",
      "1",
      "-type",
      "f",
      "-printf",
      "%f\\n",
    ]);
    const names = decoder.decode(listed.stdout).split("\n").filter(Boolean);
    const files = await Promise.all(
      names.map(async (name) => ({
        name,
        data: base64((await shell(["cat", "--", name], OUTPUT_DIR)).stdout),
      })),
    );
    return {
      stdout: decoder.decode(ran.stdout).slice(-TEXT_LIMIT),
      stderr: decoder.decode(ran.stderr).slice(-TEXT_LIMIT),
      exitCode: ran.exitCode,
      files,
    };
  }
}

const allowed = (header: string | null, token: string) => {
  const given = new TextEncoder().encode(header ?? "");
  const expected = new TextEncoder().encode(`Bearer ${token}`);
  return given.length === expected.length && crypto.subtle.timingSafeEqual(given, expected);
};

export default {
  async fetch(request, env) {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/run") {
      return new Response("Not found", { status: 404 });
    }
    if (!env.SANDBOX_TOKEN || !allowed(request.headers.get("authorization"), env.SANDBOX_TOKEN)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const parsed = runRequest.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) return new Response("Bad request", { status: 400 });
    const sandbox = env.SANDBOX.get(env.SANDBOX.idFromName(parsed.data.session));
    return Response.json(await sandbox.run(parsed.data.code));
  },
} satisfies ExportedHandler<Env>;
