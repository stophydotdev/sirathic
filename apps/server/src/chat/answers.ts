type Answer = {
  controller: AbortController;
  continuing: boolean;
  asker: "connected" | "gone";
  sent: string[];
  followers: Set<ReadableStreamDefaultController<string>>;
  done: Promise<void>;
};

const running = new Map<string, Answer>();

const keyOf = (owner: string, id: string) => `${owner}:${id}`;

export function startAnswer(owner: string, id: string, { continuing = false } = {}) {
  const key = keyOf(owner, id);
  running.get(key)?.controller.abort();
  const { promise: done, resolve: finish } = Promise.withResolvers<void>();
  const answer: Answer = {
    controller: new AbortController(),
    continuing,
    asker: "connected",
    sent: [],
    followers: new Set(),
    done,
  };
  running.set(key, answer);
  const settled = () => {
    if (running.get(key) === answer) running.delete(key);
    for (const follower of answer.followers) follower.close();
    finish();
  };
  return {
    signal: answer.controller.signal,
    consumeSseStream: ({ stream }: { stream: ReadableStream<string> }) =>
      stream
        .pipeTo(
          new WritableStream({
            write: (chunk) => {
              answer.sent.push(chunk);
              for (const follower of answer.followers) follower.enqueue(chunk);
            },
          }),
        )
        .then(settled, settled),
    toAsker: (body: ReadableStream<Uint8Array>) => {
      const reader = body.getReader();
      return new ReadableStream<Uint8Array>({
        pull: async (controller) => {
          const read = await reader.read();
          if (read.done) controller.close();
          else controller.enqueue(read.value);
        },
        cancel: (reason) => {
          answer.asker = "gone";
          return reader.cancel(reason);
        },
      });
    },
    unwatched: () => answer.asker === "gone" && answer.followers.size === 0,
  };
}

export const stopAnswer = (owner: string, id: string) =>
  running.get(keyOf(owner, id))?.controller.abort();

export const isAnswering = (owner: string, id: string) => running.has(keyOf(owner, id));

const held = new Set<Promise<void>>();

export function holdShutdown<Result>(work: Promise<Result>) {
  const settled = work.then(
    () => undefined,
    () => undefined,
  );
  held.add(settled);
  void settled.then(() => held.delete(settled));
  return work;
}

export async function drainAnswers(withinMs: number) {
  console.log(`stopping: waiting for ${running.size} answers and ${held.size} routine runs`);
  await Promise.race([
    Promise.all([...[...running.values()].map((answer) => answer.done), ...held]),
    Bun.sleep(withinMs),
  ]);
  console.log(`stopping: ${running.size} answers and ${held.size} routine runs still running`);
}

export function followAnswer(owner: string, id: string) {
  const answer = running.get(keyOf(owner, id));
  if (!answer || answer.continuing) return undefined;
  let following: ReadableStreamDefaultController<string> | undefined;
  return new ReadableStream<string>({
    start: (controller) => {
      following = controller;
      for (const chunk of answer.sent) controller.enqueue(chunk);
      answer.followers.add(controller);
    },
    cancel: () => {
      if (following) answer.followers.delete(following);
    },
  });
}
