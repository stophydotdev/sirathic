import { env } from "@sirathic/env/server";
import { RedisClient } from "bun";
import { z } from "zod";

const redis = new RedisClient(env.REDIS_URL, {
  connectionTimeout: 1_000,
  enableOfflineQueue: false,
});
const connected = Promise.race([
  redis.connect().catch(() => undefined),
  Bun.sleep(1_000),
]);

export const countUp = async (key: string, keepSeconds: number) => {
  await connected;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, keepSeconds);
  return count;
};

type CacheOptions<Value> = {
  namespace: string;
  schema: z.ZodType<Value>;
  freshMs: number;
  keepMs: number;
};

export const cacheFor = <Value>({
  namespace,
  schema,
  freshMs,
  keepMs,
}: CacheOptions<Value>) => {
  const entry = z.object({ value: schema, freshUntil: z.number() });
  const inFlight = new Map<string, Promise<Value>>();

  const read = async (key: string) => {
    await connected;
    const raw = await redis.get(key).catch(() => null);
    if (raw === null) return undefined;
    const parsed = entry.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  };

  const load = (key: string, fetchValue: () => Promise<Value>) => {
    const running = inFlight.get(key);
    if (running !== undefined) return running;
    const started = fetchValue()
      .then(async (value) => {
        const stored = JSON.stringify({
          value,
          freshUntil: Date.now() + freshMs,
        });
        await redis.set(key, stored, "PX", keepMs).catch(() => undefined);
        return value;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, started);
    return started;
  };

  return async (id: string, fetchValue: () => Promise<Value>) => {
    const key = `${namespace}:${id}`;
    const cached = await read(key).catch(() => undefined);
    if (cached === undefined) return load(key, fetchValue);
    if (cached.freshUntil > Date.now()) return cached.value;
    return load(key, fetchValue).catch(() => cached.value);
  };
};
