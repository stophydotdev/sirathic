type Answer = {
  controller: AbortController;
  continuing: boolean;
  sent: string[];
  followers: Set<ReadableStreamDefaultController<string>>;
};

const running = new Map<string, Answer>();

const keyOf = (owner: string, id: string) => `${owner}:${id}`;

export function startAnswer(owner: string, id: string, { continuing = false } = {}) {
  const key = keyOf(owner, id);
  running.get(key)?.controller.abort();
  const answer: Answer = {
    controller: new AbortController(),
    continuing,
    sent: [],
    followers: new Set(),
  };
  running.set(key, answer);
  const settled = () => {
    if (running.get(key) === answer) running.delete(key);
    for (const follower of answer.followers) follower.close();
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
  };
}

export const stopAnswer = (owner: string, id: string) =>
  running.get(keyOf(owner, id))?.controller.abort();

export const isAnswering = (owner: string, id: string) => running.has(keyOf(owner, id));

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
