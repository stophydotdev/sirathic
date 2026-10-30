import { DurableObject } from "cloudflare:workers";
import { z } from "zod";

interface Env {
  SANDBOX: DurableObjectNamespace<Sandbox>;
  SANDBOX_TOKEN: string;
}

const RUN_SECONDS = "60";
const IDLE_MS = 10 * 60_000;
const OUTPUT_DIR = "/workspace/out";
const FILES_DIR = "/workspace/files";
const TEXT_LIMIT = 20_000;
const CHUNK = 0x8000;

const file = z.object({
  name: z.string().regex(/^(?!\.\.?$)[^/\0]{1,200}$/u),
  data: z.base64(),
});

type File = z.infer<typeof file>;

const runRequest = z.object({
  session: z.string().min(1).max(100),
  code: z.string().min(1),
  files: z.array(file).max(50).default([]),
});

const decoder = new TextDecoder();

const base64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let text = "";
  for (let start = 0; start < bytes.length; start += CHUNK) {
    text += String.fromCharCode(...bytes.subarray(start, start + CHUNK));
  }
  return btoa(text);
};

const bytesOf = (data: string) => Uint8Array.from(atob(data), (char) => char.charCodeAt(0));

export class Sandbox extends DurableObject<Env> {
  private queue: Promise<unknown> = Promise.resolve();

  run(code: string, kept: File[]) {
    const next = this.queue.then(() => this.runAlone(code, kept));
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async runAlone(code: string, kept: File[]) {
    const { container } = this.ctx;
    if (!container) throw new Error("No container is configured for the sandbox");
    if (!container.running) {
      container.start({ image: container.images.python, enableInternet: false });
      await container.setInactivityTimeout(IDLE_MS);
    }
    const shell = async (command: string[], cwd = "/workspace") =>
      (await container.exec(command, { cwd })).output();
    const read = async (dir: string) => {
      const listed = await shell(["find", dir, "-maxdepth", "1", "-type", "f", "-printf", "%f\\n"]);
      const names = decoder.decode(listed.stdout).split("\n").filter(Boolean);
      return Promise.all(
        names.map(async (name) => ({
          name,
          data: base64((await shell(["cat", "--", name], dir)).stdout),
        })),
      );
    };
    await shell(["rm", "-rf", OUTPUT_DIR, FILES_DIR]);
    await shell(["mkdir", "-p", OUTPUT_DIR, FILES_DIR]);
    await Promise.all(
      kept.map(async ({ name, data }) =>
        (
          await container.exec(["dd", `of=${FILES_DIR}/${name}`, "status=none"], {
            stdin: new Response(bytesOf(data)).body ?? undefined,
          })
        ).output(),
      ),
    );
    const ran = await (
      await container.exec(["timeout", "--kill-after=5", RUN_SECONDS, "python3", "-"], {
        stdin: new Response(code).body ?? undefined,
        cwd: "/workspace",
        env: { OUTPUT_DIR, FILES_DIR, HOME: "/tmp", MPLCONFIGDIR: "/tmp/matplotlib" },
      })
    ).output();
    const before = new Map(kept.map(({ name, data }) => [name, data]));
    const now = await read(FILES_DIR);
    return {
      stdout: decoder.decode(ran.stdout).slice(-TEXT_LIMIT),
      stderr: decoder.decode(ran.stderr).slice(-TEXT_LIMIT),
      exitCode: ran.exitCode,
      files: await read(OUTPUT_DIR),
      changed: now.filter(({ name, data }) => before.get(name) !== data),
      removed: [...before.keys()].filter((name) => !now.some((entry) => entry.name === name)),
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
    return Response.json(await sandbox.run(parsed.data.code, parsed.data.files));
  },
} satisfies ExportedHandler<Env>;
