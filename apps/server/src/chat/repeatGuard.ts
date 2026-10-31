import type { ToolSet } from "ai";

const SAME_CALLS = 2;

export function limitRepeats(tools: ToolSet) {
  const repeats = new Map<string, number>();
  return Object.fromEntries(
    Object.entries(tools).map(([name, entry]) => {
      const { execute } = entry;
      return [
        name,
        execute === undefined
          ? entry
          : {
              ...entry,
              execute: (...call: Parameters<typeof execute>) => {
                const key = `${name} ${JSON.stringify(call[0])}`;
                const times = (repeats.get(key) ?? 0) + 1;
                repeats.set(key, times);
                if (times > SAME_CALLS) {
                  throw new Error(
                    `You already called ${name} with this input ${SAME_CALLS} times in this reply. Use those results or change the input.`,
                  );
                }
                return execute(...call);
              },
            },
      ];
    }),
  );
}
