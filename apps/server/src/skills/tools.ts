import { tool } from "ai";
import { z } from "zod";
import { listSkills, removeSkill, saveSkill, skillInput } from "./skills";

const skillCall = skillInput
  .pick({ name: true, instructions: true })
  .partial({ instructions: true })
  .extend({ action: z.enum(["write", "delete"]) });

const instructionsOnly = skillInput.pick({ instructions: true });

export function skillTools(owner: string) {
  return {
    update_skill: tool({
      description:
        "Saves, rewrites or deletes one of the user's own skills by name. write needs name and instructions, and rewrites the skill if you already have one with that name. delete needs name. Load the skill_authoring skill before you use it.",
      inputSchema: skillCall,
      execute: async (call) => {
        const own = await listSkills(owner);
        const named = own.find((skill) => skill.name.toLowerCase() === call.name.toLowerCase());
        if (call.action === "write") {
          const { instructions } = instructionsOnly.parse(call);
          await saveSkill(owner, { id: named?.id, name: call.name, instructions });
          return { action: call.action, name: call.name, rewritten: named !== undefined };
        }
        if (!named) {
          return `No skill named ${call.name}. The user's skills are ${own.map((skill) => skill.name).join(", ") || "none yet"}.`;
        }
        await removeSkill(owner, named.id);
        return { action: call.action, name: named.name };
      },
    }),
  };
}
