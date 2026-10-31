import { isAnswering, startRound } from "../chat/answers";
import { streamFailure } from "../chat/drain";
import { track } from "../chat/events";
import { chatResponse } from "../chat/response";
import { appendMessages, openSession } from "../chat/sessions";
import { listSkills } from "../skills/skills";
import { getSettings } from "../account/settings";
import type { User } from "../account/users";
import { reasonOf } from "../http";
import { pickModels } from "../models/pick";
import { checkNoorUsage, spendNoor } from "../models/usage";
import { connectedTools } from "../plugins/connections";
import { groupOf } from "../projects/groups";
import { botOf, listProjects, projectOfChat } from "../projects/projects";
import type { ChatMessage } from "../shared/messages";
import { DEFAULT_SETTINGS } from "../shared/settings";
import { type Member, type Room, finalReply, isSilent, mentionedBots, roomHistory } from "./room";
import type { Summon } from "./team";

const RUN_TIMEOUT_MS = 10 * 60_000;
const ROUND_TURNS = 6;
const TURNS_PER_BOT = 2;

async function botTurn({
  user,
  botId,
  chatId,
  messages,
  room,
  signal,
}: {
  user: User;
  botId: string;
  chatId: string;
  messages: ChatMessage[];
  room: Room | undefined;
  signal: AbortSignal;
}) {
  const by = user.id;
  const project = await projectOfChat(botId, by, botId);
  if (messages.at(-1)?.role !== "user" || project?.kind !== "bot") return [];
  const { modelName, models } = pickModels(user, undefined);
  await checkNoorUsage({ by, modelName, offerGpt: user.via !== "chatgpt" });
  let answered = messages;
  const response = chatResponse({
    models,
    modelName,
    messages,
    mode: "quick",
    abortSignal: AbortSignal.any([signal, AbortSignal.timeout(RUN_TIMEOUT_MS)]),
    spend: spendNoor(by, modelName),
    bot: Promise.resolve({ id: botId, owner: by }),
    preferences: getSettings(by).catch((err: Error) => {
      console.error(`settings not read: ${reasonOf(err)}`);
      return DEFAULT_SETTINGS;
    }),
    connected: connectedTools(by, project.plugins),
    project: Promise.resolve(project),
    userSkills: listSkills(by).catch(() => []),
    turn: { effort: "high", sessionId: chatId, by },
    title: undefined,
    save: async (all) => {
      answered = all;
    },
    record: (event) => track(event, by),
    fileOwner: by,
    automate: undefined,
    owner: by,
    summon: summonFor(user),
    room,
    wake: true,
    byBot: true,
  });
  const failure = await streamFailure(response);
  if (failure !== undefined) throw new Error(failure);
  return answered.slice(messages.length);
}

async function wakeTurn(user: User, botId: string, signal: AbortSignal) {
  const earlier = (await openSession(botId, user.id, false)) ?? [];
  const project = await botOf(botId, user.id);
  const added = await botTurn({
    user,
    botId,
    chatId: botId,
    messages: earlier,
    room: undefined,
    signal,
  });
  if (project && added.length > 0 && !signal.aborted) {
    await appendMessages(botId, user.id, added, { title: project.name, project: botId });
  }
}

function wakeBot(user: User, botId: string) {
  if (isAnswering(user.id, botId)) return false;
  return startRound(user.id, botId, (signal) =>
    wakeTurn(user, botId, signal).catch((err: Error) => {
      console.error(`bot ${botId} not woken: ${reasonOf(err)}`);
    }),
  );
}

async function roomTurn(user: User, room: Room, speaker: Member, signal: AbortSignal) {
  const stored = (await openSession(room.id, user.id, false)) ?? [];
  const added = await botTurn({
    user,
    botId: speaker.id,
    chatId: room.id,
    messages: roomHistory(stored, room.name, speaker.id),
    room,
    signal,
  });
  const reply = added.findLast((message) => message.role === "assistant");
  if (!reply || signal.aborted) return undefined;
  const spoken = finalReply(reply);
  if (isSilent(spoken)) return undefined;
  const posted = { ...spoken, metadata: { ...spoken.metadata, from: speaker } };
  await appendMessages(room.id, user.id, [posted], { title: room.name, project: room.id });
  return posted;
}

async function runRound(user: User, groupId: string, signal: AbortSignal, quiet?: string) {
  const group = await groupOf(groupId, user.id);
  const bots = await listProjects(user.id);
  const members = (group?.members ?? []).flatMap((id) => {
    const bot = bots.find((found) => found.id === id);
    return bot ? [{ id: bot.id, name: bot.name }] : [];
  });
  if (!group) return;
  const room = { id: group.id, name: group.name, members };
  const turns = new Map<string, number>();
  const takeTurns = async (queue: readonly string[]): Promise<void> => {
    const [next, ...rest] = queue;
    const speaker = members.find(({ id }) => id === next);
    if (next === undefined || signal.aborted) return;
    if (
      !speaker ||
      (turns.get(next) ?? 0) >= TURNS_PER_BOT ||
      [...turns.values()].reduce((a, b) => a + b, 0) >= ROUND_TURNS
    ) {
      return takeTurns(rest);
    }
    turns.set(next, (turns.get(next) ?? 0) + 1);
    const posted = await roomTurn(user, room, speaker, signal).catch((err: Error) => {
      console.error(`bot ${next} did not take its turn in ${groupId}: ${reasonOf(err)}`);
      return undefined;
    });
    const asked = mentionedBots(
      posted?.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join(" ") ?? "",
      members,
      next,
    ).map(({ id }) => id);
    return takeTurns([...rest, ...asked.filter((id) => !rest.includes(id))]);
  };
  await takeTurns(members.flatMap(({ id }) => (id === quiet ? [] : [id])));
}

export function wakeGroup(user: User, groupId: string, takeOver: boolean, quiet?: string) {
  if (isAnswering(user.id, groupId) && !takeOver) return false;
  return startRound(user.id, groupId, (signal) =>
    runRound(user, groupId, signal, quiet).catch((err: Error) => {
      console.error(`group ${groupId} round failed: ${reasonOf(err)}`);
    }),
  );
}

export const summonFor =
  (user: User): Summon =>
  (target) =>
    target.kind === "bot"
      ? wakeBot(user, target.id)
      : wakeGroup(user, target.id, false, target.from);
