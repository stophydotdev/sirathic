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

export const routineCall = fields
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
      description: `Creates, edits, pauses, resumes or deletes one of the user's routines. A routine is a prompt that runs by itself on a schedule and saves each answer as a chat. Load the routines skill before you use it. edit takes only the fields that change. The prompt says the goal and who it is for, tells the run to reply with exactly SKIP when there is nothing useful, and holds no verse or hadith text and nothing private. Times near a prayer are fixed clock times: ask for the local timetable, never guess them.`,
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
        "Lists the user's routines with their id, schedule and whether they are paused. Use it when they ask what routines they have, and before you edit, pause, resume or delete one, to get its id.",
      inputSchema: z.object({}),
      execute: () => listAutomations(owner),
    }),
  };
}
