import { env } from "@sirathic/env/server";

const client = new Bun.S3Client({
  endpoint: env.STORAGE_ENDPOINT,
  region: env.STORAGE_REGION,
  bucket: env.STORAGE_BUCKET,
  accessKeyId: env.STORAGE_ACCESS_KEY_ID,
  secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
});

export const storage = {
  put: (key: string, bytes: Uint8Array, type: string) => client.write(key, bytes, { type }),
  bytes: (key: string) => client.file(key).bytes(),
  remove: (key: string) => client.delete(key),
};
