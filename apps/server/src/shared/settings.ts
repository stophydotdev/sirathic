import { z } from "zod";

export const MADHABS = ["none", "hanafi", "maliki", "shafii", "hanbali"] as const;
export const MEMORY_LIMIT = 20;
export const MEMORY_CHARS = 200;
export const RULE_EFFECTS = ["allow", "ask"] as const;
export const RULE_LIMIT = 20;
export const RULE_CHARS = 120;

const isTimeZone = (zone: string) => {
  try {
    return Intl.DateTimeFormat("en", { timeZone: zone }).resolvedOptions().timeZone.length > 0;
  } catch {
    return false;
  }
};

export const timezone = z.string().refine(isTimeZone, "unknown time zone");

export const rule = z.object({
  text: z.string().trim().min(1).max(RULE_CHARS),
  effect: z.enum(RULE_EFFECTS),
});

export const settings = z.object({
  name: z.string().trim().max(80),
  about: z.string().trim().max(500),
  timezone: timezone.or(z.literal("")),
  madhab: z.enum(MADHABS),
  instructions: z.string().trim().max(1500),
  memory: z.array(z.string().trim().min(1).max(MEMORY_CHARS)).max(MEMORY_LIMIT),
  saveMemory: z.boolean(),
  usePastChats: z.boolean(),
  rules: z.array(rule).max(RULE_LIMIT),
});

export const settingsUpdate = settings.partial();

export type Settings = z.infer<typeof settings>;

export const DEFAULT_SETTINGS: Settings = {
  name: "",
  about: "",
  timezone: "",
  madhab: "none",
  instructions: "",
  memory: [],
  saveMemory: true,
  usePastChats: true,
  rules: [],
};
