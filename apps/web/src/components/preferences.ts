import type { MessageKey } from "@/messages/en";
import { z } from "zod";
import { create } from "zustand";

const STORAGE_KEY = "sirathicPreferences";

export const THEMES = ["dark", "light", "system"] as const;

export const ANSWER_FONTS = ["sans", "serif"] as const;

export const THEME_NAMES = {
  dark: "Dark",
  light: "Light",
  system: "System",
} satisfies Record<(typeof THEMES)[number], MessageKey>;

const saved = z.object({
  theme: z.enum(THEMES).catch("dark"),
  incognitoByDefault: z.boolean().catch(false),
  routineAlerts: z.boolean().catch(true),
  answerAlerts: z.boolean().catch(true),
  answerFont: z.enum(ANSWER_FONTS).catch("sans"),
});

type Preferences = z.infer<typeof saved>;

const DEFAULTS: Preferences = saved.parse({});

export const themeScript = `try{var p=JSON.parse(localStorage.getItem("${STORAGE_KEY}")||"{}"),t=p.theme||"dark";document.documentElement.classList.toggle("dark",t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches))}catch(e){}`;

const systemDark = () => globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;

function applyTheme({ theme }: Preferences) {
  const dark = theme === "dark" || (theme === "system" && systemDark());
  document.documentElement.classList.toggle("dark", dark);
}

export const usePreferences = create<
  Preferences & {
    load: () => void;
    change: (next: Partial<Preferences>) => void;
  }
>()((set, get) => ({
  ...DEFAULTS,
  load: () => {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const loaded = saved.parse(raw ? JSON.parse(raw) : {});
    set(loaded);
    applyTheme(loaded);
  },
  change: (next) => {
    set(next);
    const preferences = saved.parse(get());
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(preferences));
    applyTheme(preferences);
  },
}));
