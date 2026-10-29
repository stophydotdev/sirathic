import { ANSWER_FONTS, PALETTES, THEMES } from "@sirathic/app/preferences";
import { MODES } from "@sirathic/server/messages";
import type { FC } from "react";
import { Pressable, Text, View } from "react-native";
import { useChatState } from "@/lib/chat-state";
import { paletteColors, usePreferences } from "@/lib/preferences";
import { MODE_DETAILS } from "./composer";
import { Group, Segmented, Setting } from "./settings-controls";

const THEME_NAMES = { dark: "Dark", light: "Light", system: "System" } satisfies Record<
  (typeof THEMES)[number],
  string
>;

const PALETTE_NAMES = {
  sirathic: "Sirathic",
  grove: "Grove",
  ocean: "Ocean",
  ember: "Ember",
  iris: "Iris",
  rose: "Rose",
} satisfies Record<(typeof PALETTES)[number], string>;

const FONT_NAMES = { sans: "Sans", serif: "Serif" } satisfies Record<
  (typeof ANSWER_FONTS)[number],
  string
>;

const SKETCH_TONES = {
  light: { page: "bg-white", side: "bg-neutral-100", line: "bg-neutral-300" },
  dark: { page: "bg-neutral-900", side: "bg-neutral-800", line: "bg-neutral-700" },
} as const;

const ThemeSketch: FC<{ tone: keyof typeof SKETCH_TONES; half?: boolean }> = ({
  tone,
  half = false,
}) => {
  const { page, side, line } = SKETCH_TONES[tone];
  return (
    <View
      className={`absolute inset-y-0 end-0 flex-row overflow-hidden ${half ? "w-1/2" : "start-0"} ${page}`}
    >
      {!half && <View className={`w-1/4 ${side}`} />}
      <View className="flex-1 gap-1.5 p-2.5">
        <View className={`h-1.5 w-3/4 rounded-full ${line}`} />
        <View className={`h-1.5 w-1/2 rounded-full ${line}`} />
        <View className={`mt-auto h-3 rounded-sm ${line}`} />
      </View>
    </View>
  );
};

const ThemePictures: FC = () => {
  const theme = usePreferences((s) => s.theme);
  const change = usePreferences((s) => s.change);
  return (
    <View accessibilityRole="radiogroup" className="w-full flex-row gap-2.5">
      {THEMES.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="radio"
          accessibilityState={{ checked: option === theme }}
          onPress={() => change({ theme: option })}
          className="flex-1 items-center gap-1.5"
        >
          <View
            className={`h-16 w-full overflow-hidden rounded-[10px] border ${option === theme ? "border-foreground/60 border-2" : "border-foreground/10"}`}
          >
            <ThemeSketch tone={option === "dark" ? "dark" : "light"} />
            {option === "system" && <ThemeSketch tone="dark" half />}
          </View>
          <Text
            className={`font-sans text-xs ${option === theme ? "text-foreground" : "text-muted-foreground"}`}
          >
            {THEME_NAMES[option]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

const PalettePictures: FC = () => {
  const palette = usePreferences((s) => s.palette);
  const change = usePreferences((s) => s.change);
  return (
    <View accessibilityRole="radiogroup" className="w-full flex-row flex-wrap gap-2.5">
      {PALETTES.map((option) => {
        const colors = paletteColors(option);
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: option === palette }}
            onPress={() => change({ palette: option })}
            className={`basis-1/4 grow items-center gap-1.5 rounded-[10px] border py-2.5 ${option === palette ? "border-foreground/60 border-2" : "border-foreground/10"}`}
          >
            <View className="border-foreground/15 size-10 flex-row overflow-hidden rounded-full border">
              {(["light", "dark"] as const).map((mode) => (
                <View
                  key={mode}
                  style={{ backgroundColor: colors[mode].background }}
                  className="flex-1 items-start justify-center ps-0.5"
                >
                  <View
                    style={{ backgroundColor: colors[mode].super }}
                    className="size-3.5 rounded-full"
                  />
                </View>
              ))}
            </View>
            <Text
              className={`font-sans text-xs ${option === palette ? "text-foreground" : "text-muted-foreground"}`}
            >
              {PALETTE_NAMES[option]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export const AppearanceSection: FC = () => {
  const answerFont = usePreferences((s) => s.answerFont);
  const change = usePreferences((s) => s.change);
  return (
    <Group>
      <Setting label="Theme" stacked>
        <ThemePictures />
      </Setting>
      <Setting label="Colors" stacked>
        <PalettePictures />
      </Setting>
      <Setting label="Answer font" hint="How answers look">
        <Segmented
          value={answerFont}
          options={ANSWER_FONTS.map((value) => [value, FONT_NAMES[value]] as const)}
          onChange={(next) => change({ answerFont: next })}
        />
      </Setting>
    </Group>
  );
};

export const BehaviorSection: FC = () => {
  const defaultMode = usePreferences((s) => s.defaultMode);
  const change = usePreferences((s) => s.change);
  return (
    <Group>
      <Setting label="Default mode" hint={MODE_DETAILS[defaultMode].description} stacked>
        <Segmented
          value={defaultMode}
          options={MODES.map((value) => [value, MODE_DETAILS[value].name] as const)}
          onChange={(next) => {
            change({ defaultMode: next });
            useChatState.getState().setMode(next);
          }}
        />
      </Setting>
    </Group>
  );
};
