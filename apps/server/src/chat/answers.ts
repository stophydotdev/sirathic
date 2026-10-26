const running = new Map<string, AbortController>();

const keyOf = (owner: string, id: string) => `${owner}:${id}`;

export function startAnswer(owner: string, id: string) {
  const key = keyOf(owner, id);
  running.get(key)?.abort();
  const controller = new AbortController();
  running.set(key, controller);
  return {
    signal: controller.signal,
    settled: () => {
      if (running.get(key) === controller) running.delete(key);
    },
  };
}

export const stopAnswer = (owner: string, id: string) => running.get(keyOf(owner, id))?.abort();

export const isAnswering = (owner: string, id: string) => running.has(keyOf(owner, id));
