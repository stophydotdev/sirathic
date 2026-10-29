import { ANSWER_FONTS, PALETTES, THEMES } from "@sirathic/app/preferences";
import { mode } from "@sirathic/server/messages";
import * as SecureStore from "expo-secure-store";
import { Uniwind } from "uniwind";
import { z } from "zod";
import { create } from "zustand";

const STORAGE_KEY = "sirathic_preferences";

type Palette = (typeof PALETTES)[number];

type Colors = {
  background: string;
  card: string;
  sidebar: string;
  super: string;
  bubble: string;
};

const PALETTE_COLORS = {
  sirathic: {
    light: {
      background: "#ffffff",
      card: "#ffffff",
      sidebar: "#fafafa",
      super: "#20808d",
      bubble: "rgba(10, 10, 10, 0.03)",
    },
    dark: {
      background: "#161616",
      card: "#1d1d1d",
      sidebar: "#1c1c1c",
      super: "#4e99a3",
      bubble: "rgba(222, 222, 222, 0.03)",
    },
  },
  grove: {
    light: {
      background: "#f3f7f4",
      card: "#f3f7f4",
      sidebar: "#e1ede7",
      super: "#1b7d50",
      bubble: "#cce1d7",
    },
    dark: {
      background: "#1a2821",
      card: "#25332c",
      sidebar: "#21362b",
      super: "#69d69a",
      bubble: "#37664d",
    },
  },
  ocean: {
    light: {
      background: "#f5f7f8",
      card: "#f5f7f8",
      sidebar: "#e4ecf2",
      super: "#2672af",
      bubble: "#d0dfeb",
    },
    dark: {
      background: "#17212b",
      card: "#222c36",
      sidebar: "#1e2d3b",
      super: "#70b9ee",
      bubble: "#375871",
    },
  },
  ember: {
    light: {
      background: "#f9f7f5",
      card: "#f9f7f5",
      sidebar: "#f3eae5",
      super: "#ae562a",
      bubble: "#ebdad1",
    },
    dark: {
      background: "#291e1a",
      card: "#342925",
      sidebar: "#39281f",
      super: "#f09a64",
      bubble: "#704b34",
    },
  },
  iris: {
    light: {
      background: "#f8f7fa",
      card: "#f8f7fa",
      sidebar: "#ede9f4",
      super: "#7153b9",
      bubble: "#e0d9ee",
    },
    dark: {
      background: "#1d1929",
      card: "#282434",
      sidebar: "#272139",
      super: "#9d7df2",
      bubble: "#4b3d72",
    },
  },
  rose: {
    light: {
      background: "#fdf7fd",
      card: "#fdf7fd",
      sidebar: "#f2e1f4",
      super: "#db2777",
      bubble: "#f7def2",
    },
    dark: {
      background: "#1f1a24",
      card: "#2a252f",
      sidebar: "#171018",
      super: "#db2777",
      bubble: "#2b2431",
    },
  },
} satisfies Record<Palette, Record<"light" | "dark", Colors>>;

export const paletteColors = (palette: Palette) => PALETTE_COLORS[palette];

const saved = z.object({
  theme: z.enum(THEMES).catch("dark"),
  palette: z.enum(PALETTES).catch("sirathic"),
  answerFont: z.enum(ANSWER_FONTS).catch("sans"),
  incognitoByDefault: z.boolean().catch(false),
  defaultMode: mode.catch("quick"),
});

type Preferences = z.infer<typeof saved>;

const json = z.string().transform((text, ctx) => {
  try {
    return JSON.parse(text);
  } catch {
    ctx.addIssue({ code: "custom", message: "not json" });
    return z.NEVER;
  }
});

const stored = () => saved.parse(json.catch({}).parse(SecureStore.getItem(STORAGE_KEY) ?? ""));

const variablesOf = (colors: Colors) => ({
  "--color-background": colors.background,
  "--color-card": colors.card,
  "--color-popover": colors.card,
  "--color-sidebar": colors.sidebar,
  "--color-super": colors.super,
  "--color-bubble": colors.bubble,
});

const apply = ({ theme, palette }: Preferences) => {
  const colors = PALETTE_COLORS[palette];
  Uniwind.updateCSSVariables("light", variablesOf(colors.light));
  Uniwind.updateCSSVariables("dark", variablesOf(colors.dark));
  Uniwind.setTheme(theme);
};

export const usePreferences = create<
  Preferences & { load: () => void; change: (next: Partial<Preferences>) => void }
>()((set, get) => ({
  ...stored(),
  load: () => {
    const loaded = stored();
    set(loaded);
    apply(loaded);
  },
  change: (next) => {
    set(next);
    const preferences = saved.parse(get());
    SecureStore.setItem(STORAGE_KEY, JSON.stringify(preferences));
    apply(preferences);
  },
}));
