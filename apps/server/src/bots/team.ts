import { tool } from "ai";
import { z } from "zod";
import { appendMessages, openSession } from "../chat/sessions";
import { groupOf, listGroups } from "../projects/groups";
import {
  botOf,
  botTitle,
  createProject,
  listProjects,
  projectId,
  projectInstructions,
  projectName,
  updateProject,
} from "../projects/projects";
import type { ChatMessage } from "../shared/messages";
import { BOT_BODIES, BOT_COLORS } from "../shared/projects";
import { type BotScope, NAMING } from "./tools";

export type Summon = (
  target: { kind: "bot"; id: string } | { kind: "group"; id: string; from: string },
) => boolean;

const MAX_AGENT_MESSAGES = 3;

const botPostsInARow = (messages: readonly ChatMessage[]) =>
  messages
    .slice(
      messages.findLastIndex((message) => message.role === "user" && !message.metadata?.from) + 1,
    )
    .filter((message) => message.role === "user" && message.metadata?.from).length;

export async function teammatesOf(owner: string, self: string) {
  const [bots, groups] = await Promise.all([
    listProjects(owner).catch(() => []),
    listGroups(owner).catch(() => []),
  ]);
  return {
    bots: bots.filter((other) => other.id !== self),
    groups: groups.filter((group) => group.members?.includes(self)),
  };
}

const bot = z.object({ id: projectId.describe("The id from your teammates or groups list") });

export function teamTools(
  { id, owner }: BotScope,
  summon: Summon,
  room: string | undefined,
  withUser: boolean,
) {
  const tools = {
    create_bot: tool({
      description: `Creates a new bot, a teammate for the user, for a focused job. Returns its id so you can message it right away with message_bot. You have no tool to delete a bot, so create one only when the user asked for it or agreed to it and it is genuinely useful. ${NAMING} The name is one to three words. The title is a short role. The job is a few sentences in the user's words that tell the bot what to do in every reply, without rulings and without limits they did not ask for. Pick a color and a body only when the user cares, otherwise leave them out. The user sees a line saying the bot was created, so don't repeat it.`,
      inputSchema: z.object({
        name: projectName,
        title: botTitle,
        job: projectInstructions.min(1),
        color: z.enum(BOT_COLORS).optional(),
        body: z.enum(BOT_BODIES).optional(),
      }),
      execute: async ({ name, title, job, color, body }) => {
        const created = await createProject(owner, {
          name,
          title,
          instructions: job,
          color,
          symbol: body,
        });
        return { id: created.id, name: created.name };
      },
    }),
    update_bot: tool({
      description: `Changes a teammate's name, title or job. Only the fields you pass change. ${NAMING} Use it to refine a teammate you or the user created, when the user asks. The user sees a line saying the bot was renamed, so don't repeat it.`,
      inputSchema: bot.extend({
        name: projectName.optional(),
        title: botTitle.optional(),
        job: projectInstructions.min(1).optional(),
      }),
      execute: async ({ id: botId, name, title, job }) => {
        if (!(await botOf(botId, owner))) return "No teammate has that id.";
        if (name === undefined && title === undefined && job === undefined) {
          return "Nothing to change.";
        }
        const changed = await updateProject(botId, owner, { name, title, instructions: job });
        return { id: changed.id, name: changed.name };
      },
    }),
    message_bot: tool({
      description:
        "Sends a message to a teammate by id, or posts into a group chat you belong to by its id. It is asynchronous, like texting: it delivers at once and returns an acknowledgement, and you must not wait or poll for a reply. A reply arrives later as its own message. priority is required. true wakes the teammate now, for anything they must act on or anyone is waiting on, like a task, a question you need answered, a handoff, a stop or a change of plan. false does not wake them: the message is held and read at the start of their next turn, whenever that is, which is right for a status update, an FYI, an acknowledgement or thanks. When in doubt whether someone is waiting, use true. Use it deliberately and sparingly: waking another bot is a real side effect, so treat it like sending on the user's behalf, and never relay the user's private words verbatim. Group posts always land and wake the group, whatever the priority. Keep the message purposeful and minimal.",
      inputSchema: bot.extend({
        message: z.string().trim().min(1).max(4000),
        priority: z.boolean(),
      }),
      execute: async ({ id: targetId, message, priority }) => {
        if (targetId === id) return "That is you. Message a teammate.";
        if (targetId === room) return "You are in that room already. Just write your reply.";
        const [target, group, sender] = await Promise.all([
          botOf(targetId, owner),
          groupOf(targetId, owner),
          botOf(id, owner),
        ]);
        const recipient = target ?? group;
        if (!recipient || !sender) return "No teammate or group has that id.";
        if (group && !group.members?.includes(id)) return "You are not in that group.";
        const looping =
          botPostsInARow((await openSession(recipient.id, owner, false)) ?? []) >=
          MAX_AGENT_MESSAGES;
        await appendMessages(
          recipient.id,
          owner,
          [
            {
              id: crypto.randomUUID(),
              role: "user",
              metadata: { createdAt: Date.now(), from: { id: sender.id, name: sender.name } },
              parts: [{ type: "text", text: message }],
            },
          ],
          { title: recipient.name, project: recipient.id },
        );
        const woke =
          (group || priority) &&
          !looping &&
          summon(
            group ? { kind: "group", id: group.id, from: id } : { kind: "bot", id: recipient.id },
          );
        const held =
          (group || priority) && !woke
            ? looping
              ? "There have already been several bot messages there without the user, so it waits for their next turn."
              : "They are busy right now, so it waits for their next turn."
            : undefined;
        return { sentTo: recipient.name, id: recipient.id, ...(held && { held }) };
      },
    }),
  };
  return withUser ? tools : { message_bot: tools.message_bot };
}
