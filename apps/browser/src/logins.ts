import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import type { BrowserContext } from "patchright";
import { z } from "zod";

const DIRECTORY = "/data/logins";

const storageState = z.object({
  cookies: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      domain: z.string(),
      path: z.string(),
      expires: z.number(),
      httpOnly: z.boolean(),
      secure: z.boolean(),
      sameSite: z.enum(["Strict", "Lax", "None"]),
    }),
  ),
  origins: z.array(
    z.object({
      origin: z.string(),
      localStorage: z.array(z.object({ name: z.string(), value: z.string() })),
    }),
  ),
});

const savedState = storageState.extend({
  page: z.object({ url: z.string(), at: z.number() }).optional(),
});

const fileOf = (session: string) =>
  `${DIRECTORY}/${createHash("sha256").update(session).digest("hex")}.json`;

export const savedLogins = async (session: string) => {
  const saved = await Bun.file(fileOf(session))
    .json()
    .catch(() => undefined);
  return savedState.safeParse(saved).data;
};

export const saveLogins = async (session: string, context: BrowserContext, url: string) => {
  const state = storageState.parse(await context.storageState());
  await mkdir(DIRECTORY, { recursive: true, mode: 0o700 });
  await writeFile(fileOf(session), JSON.stringify({ ...state, page: { url, at: Date.now() } }), {
    mode: 0o600,
  });
};

export const forgetLogins = (session: string) => rm(fileOf(session), { force: true });
