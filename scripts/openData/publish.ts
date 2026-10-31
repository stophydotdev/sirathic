import { readdirSync } from "node:fs";
import { S3Client } from "bun";
import { getPlatformProxy } from "wrangler";
import { z } from "zod";
import { contentTypeOf } from "./output";
import { mapLimit } from "./util";

const remoteEnv = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
});

const keysIn = (dir: string) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `${entry.parentPath}/${entry.name}`.slice(dir.length + 1));

type LocalBucket = {
  put: (
    key: string,
    value: ArrayBuffer,
    options: { httpMetadata: { contentType: string } },
  ) => Promise<object>;
};

export const publishLocal = async (dir: string, configPath: string, statePath: string) => {
  const proxy = await getPlatformProxy<{ DATA: LocalBucket }>({
    configPath,
    persist: { path: statePath },
  });
  const keys = keysIn(dir);
  await mapLimit(keys, 16, async (key) =>
    proxy.env.DATA.put(key, await Bun.file(`${dir}/${key}`).arrayBuffer(), {
      httpMetadata: { contentType: contentTypeOf(key) },
    }),
  );
  await proxy.dispose();
  return keys.length;
};

export const publishRemote = async (dir: string) => {
  const env = remoteEnv.parse(process.env);
  const bucket = new S3Client({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    bucket: env.R2_BUCKET,
    region: "auto",
  });
  const keys = keysIn(dir);
  await mapLimit(keys, 16, (key) =>
    bucket.write(key, Bun.file(`${dir}/${key}`), { type: contentTypeOf(key) }),
  );
  return keys.length;
};
