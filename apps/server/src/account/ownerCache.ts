const KEEP_MS = 60_000;

export function ownerCache<Value>() {
  const entries = new Map<string, Promise<Value>>();
  const forget = (key: string, entry: Promise<Value>) => {
    if (entries.get(key) === entry) entries.delete(key);
  };
  return {
    get(key: string, load: () => Promise<Value>) {
      const kept = entries.get(key);
      if (kept) return kept;
      const loading = load();
      entries.set(key, loading);
      loading.then(
        () => setTimeout(() => forget(key, loading), KEEP_MS).unref(),
        () => forget(key, loading),
      );
      return loading;
    },
    clear: (key: string) => void entries.delete(key),
  };
}
