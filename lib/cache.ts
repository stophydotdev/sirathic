const store = new Map<string, { value: unknown; expires: number }>();

const MAX_ENTRIES = 500;

export const cached = async <T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> => {
  const hit = store.get(key);

  if (hit && hit.expires > Date.now()) {
    return hit.value as T;
  }

  const value = await fn();
  store.set(key, { value, expires: Date.now() + ttlMs });

  if (store.size > MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of store) {
      if (v.expires < now) store.delete(k);
    }
    for (const k of store.keys()) {
      if (store.size <= MAX_ENTRIES) break;
      store.delete(k);
    }
  }

  return value;
};
