import { env } from "@sirathic/env/server";
import { RedisClient } from "bun";
import { z } from "zod";
import { reasonOf } from "../http";
import { eventId, type RealtimeEvent, realtimeEvent } from "../shared/realtime";

const CHANNEL = "rt";
const KEPT_EVENTS = "200";
const KEEP_SECONDS = 24 * 60 * 60;
const PING_MS = 30_000;
const BEAT_MS = 5000;
const NO_EVENTS = "0-0";

const liveUsers = new Set(
  env.REALTIME_USERS.split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

export const isLive = (owner: string) => liveUsers.has("*") || liveUsers.has(owner);

const streamOf = (owner: string) => `rt:${owner}`;

const hubMessage = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("event"), owner: z.string(), id: eventId, event: realtimeEvent }),
  z.object({ kind: z.literal("close"), owner: z.string(), sessionId: z.string() }),
  z.object({ kind: z.literal("beat"), id: z.string() }),
]);

const streamEntries = z.array(z.tuple([eventId, z.tuple([z.literal("event"), z.string()])]));

type Frame = { id: string; event: RealtimeEvent };

export type Device = {
  owner: string;
  sessionId: string;
  send: (frame: Frame) => void;
  close: (code: number, reason: string) => void;
  ping: () => void;
  arrivedWhileJoining: Frame[] | undefined;
};

const devices = new Map<string, Set<Device>>();

const commands = new RedisClient(env.REDIS_URL, { enableOfflineQueue: false });
const listener = new RedisClient(env.REDIS_URL);
let commandsReady: Promise<void> | undefined;
let listening: Promise<number> | undefined;
let beatSent: string | undefined;
let beatHeard: string | undefined;

const ready = () => (commandsReady ??= commands.connect());

const isAfter = (id: string, other: string) => {
  const [ms = 0, seq = 0] = id.split("-").map(Number);
  const [otherMs = 0, otherSeq = 0] = other.split("-").map(Number);
  return ms > otherMs || (ms === otherMs && seq > otherSeq);
};

const framesIn = async (command: "XRANGE" | "XREVRANGE", args: string[]) => {
  await ready();
  return streamEntries
    .parse(await commands.send(command, args))
    .map(([id, [, event]]): Frame => ({ id, event: realtimeEvent.parse(JSON.parse(event)) }));
};

const latestId = async (owner: string) => {
  const [last] = await framesIn("XREVRANGE", [streamOf(owner), "+", "-", "COUNT", "1"]);
  return last?.id ?? NO_EVENTS;
};

const missedSince = async (owner: string, after: string) => {
  const [first] = await framesIn("XRANGE", [streamOf(owner), "-", "+", "COUNT", "1"]);
  if (!first || isAfter(first.id, after)) return undefined;
  return framesIn("XRANGE", [streamOf(owner), `(${after}`, "+"]);
};

const everyDevice = () => [...devices.values()].flatMap((own) => Array.from(own));

const sendReset = (device: Device) =>
  latestId(device.owner).then(
    (id) => device.send({ id, event: { kind: "reset" } }),
    () => device.close(1011, "events unavailable"),
  );

const hear = (raw: string) => {
  const message = hubMessage.safeParse(JSON.parse(raw));
  if (!message.success) return;
  const heard = message.data;
  if (heard.kind === "beat") {
    beatHeard = heard.id;
    return;
  }
  for (const device of devices.get(heard.owner) ?? []) {
    switch (heard.kind) {
      case "event": {
        const frame = { id: heard.id, event: heard.event };
        if (device.arrivedWhileJoining) device.arrivedWhileJoining.push(frame);
        else device.send(frame);
        break;
      }
      case "close":
        if (device.sessionId === heard.sessionId) device.close(4401, "signed out");
        break;
    }
  }
};

const shareMessage = async (message: z.infer<typeof hubMessage>) => {
  await ready();
  await commands.publish(CHANNEL, JSON.stringify(message));
};

const resubscribe = async () => {
  await listener.unsubscribe(CHANNEL).catch(() => undefined);
  listening = listener.subscribe(CHANNEL, hear);
  await listening;
  for (const device of everyDevice()) void sendReset(device);
};

const beat = async () => {
  if (beatSent !== beatHeard) await resubscribe();
  beatSent = crypto.randomUUID();
  await shareMessage({ kind: "beat", id: beatSent });
};

const listen = () => {
  if (listening) return listening;
  setInterval(() => {
    for (const device of everyDevice()) device.ping();
  }, PING_MS);
  setInterval(() => {
    void beat().catch((err: Error) => {
      console.error(`realtime events unavailable: ${reasonOf(err)}`);
      closeAll(1011, "events unavailable");
    });
  }, BEAT_MS);
  listening = listener.subscribe(CHANNEL, hear);
  return listening;
};

export function publish(owner: string, event: RealtimeEvent) {
  if (!isLive(owner)) return;
  const stream = streamOf(owner);
  void ready()
    .then(() =>
      commands.send("XADD", [
        stream,
        "MAXLEN",
        "~",
        KEPT_EVENTS,
        "*",
        "event",
        JSON.stringify(event),
      ]),
    )
    .then(async (added) => {
      await commands.expire(stream, KEEP_SECONDS);
      await shareMessage({ kind: "event", owner, id: eventId.parse(added), event });
    })
    .catch((err: Error) => {
      console.error(`realtime event not sent: ${reasonOf(err)}`);
    });
}

export function closeSession(owner: string, sessionId: string) {
  if (!isLive(owner)) return;
  void shareMessage({ kind: "close", owner, sessionId }).catch((err: Error) => {
    console.error(`realtime close not sent: ${reasonOf(err)}`);
  });
}

const catchUp = async (device: Device, after: string | undefined) => {
  await listen();
  const missed = after === undefined ? [] : await missedSince(device.owner, after);
  const frames: Frame[] = missed ?? [
    { id: await latestId(device.owner), event: { kind: "reset" } },
  ];
  let last = after;
  for (const frame of [...frames, ...(device.arrivedWhileJoining ?? [])]) {
    if (last !== undefined && frame.event.kind !== "reset" && !isAfter(frame.id, last)) continue;
    device.send(frame);
    last = frame.id;
  }
  device.arrivedWhileJoining = undefined;
};

export function join(device: Device, after: string | undefined) {
  device.arrivedWhileJoining = [];
  devices.set(device.owner, (devices.get(device.owner) ?? new Set()).add(device));
  return catchUp(device, after).catch((err: Error) => {
    console.error(`realtime join failed: ${reasonOf(err)}`);
    device.close(1011, "events unavailable");
  });
}

export function leave(device: Device) {
  const own = devices.get(device.owner);
  own?.delete(device);
  if (own?.size === 0) devices.delete(device.owner);
}

export function closeAll(code: number, reason: string) {
  for (const device of everyDevice()) device.close(code, reason);
}

export const sentAt = (id: string) => Number(id.split("-")[0]);
