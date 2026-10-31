import { tool } from "ai";
import { z } from "zod";
import {
  automationId,
  automationInput,
  createAutomation,
  listAutomations,
  removeAutomation,
  updateAutomation,
} from "./store";

const ACTIONS = ["create", "edit", "pause", "resume", "delete"] as const;

const fields = automationInput.pick({ name: true, prompt: true, schedule: true });

const REQUIRED = {
  create: ["name", "prompt", "schedule"],
  edit: ["id"],
  pause: ["id"],
  resume: ["id"],
  delete: ["id", "name"],
} as const satisfies Record<
  (typeof ACTIONS)[number],
  readonly (keyof z.input<typeof fields> | "id")[]
>;

const routineCall = fields
  .partial()
  .extend({
    action: z.enum(ACTIONS),
    id: automationId.optional().describe("The routine's id from list_routines."),
  })
  .superRefine((call, ctx) => {
    for (const key of REQUIRED[call.action]) {
      if (call[key] === undefined) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `${key} is required to ${call.action}`,
        });
      }
    }
  });

const needsId = z.object({ id: automationId });

export type AutomationScope = { owner: string; timezone: string; projectId?: string };

export function routineTools({ owner, timezone, projectId }: AutomationScope) {
  return {
    update_routine: tool({
      description: `Be proactive: when an ask is recurring, time-based, or "tell me when X", create a routine (or offer one when unsure it's wanted) instead of doing it once. Creates, edits, pauses, resumes or deletes one of the user's routines: saved prompts that run on a schedule, even while the user is away, and save each answer as a chat. Their current routines and ids come from list_routines. Load the routines skill before you create or change one; it has the full recipe. create needs name, prompt and schedule. edit needs id and only the fields to change. pause, resume and delete need id. The prompt is written to your future self as an intent, not a frozen tool recipe: the goal, who it is for, and a line telling the run to reply with exactly SKIP when there is nothing useful. It holds no verse or hadith text and no sin. A time tied to a prayer, like 15 minutes before Maghrib, is a daily schedule with prayer set, so it moves with the prayer every day; never guess a prayer time. A change takes effect at once, with no card.`,
      inputSchema: routineCall,
      execute: async (call) => {
        switch (call.action) {
          case "create": {
            const routine = await createAutomation(owner, {
              ...fields.parse(call),
              timezone,
              projectId,
            });
            return { action: call.action, ...routine };
          }
          case "edit": {
            const { id } = needsId.parse(call);
            const { name, prompt, schedule } = call;
            const routine = await updateAutomation(id, owner, { name, prompt, schedule });
            return { action: call.action, ...routine };
          }
          case "pause":
          case "resume": {
            const { id } = needsId.parse(call);
            const routine = await updateAutomation(id, owner, {
              enabled: call.action === "resume",
            });
            return { action: call.action, ...routine };
          }
          case "delete": {
            const { id } = needsId.parse(call);
            const { name } = await removeAutomation(id, owner);
            return { action: call.action, id, name };
          }
        }
      },
    }),
    list_routines: tool({
      description:
        "Lists the user's routines with their id, saved prompt, schedule and whether they are paused. Use it when they ask what routines they have, and before you edit, pause, resume or delete one: read its saved prompt and edit that text rather than rewriting it from memory.",
      inputSchema: z.object({}),
      execute: () => listAutomations(owner),
    }),
  };
}
