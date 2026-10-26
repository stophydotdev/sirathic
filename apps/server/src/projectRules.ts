import type { z } from "zod";
import { rememberedUpdate, type told } from "./shared/settings";

export const projectRemembered = (memory: readonly string[], input: z.output<typeof told>) => {
  const { memory: kept, ...preferences } = rememberedUpdate(memory, input);
  return { memory: kept, preferences };
};

export const projectRules = (project: { name: string; instructions: string } | undefined) =>
  project?.instructions
    ? `\n\nThis chat is in the project "${project.name}". Follow its instructions:\n${project.instructions}`
    : "";

export const settingsInProject = <Settings extends { memory: unknown }>(
  settings: Settings,
  project: { projectOnlyMemory: boolean; memory: Settings["memory"] } | undefined,
) => (project?.projectOnlyMemory ? { ...settings, memory: project.memory } : settings);
