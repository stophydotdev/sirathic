"use client";

import { useAccount } from "@/components/account";
import { MODE_DETAILS, useChatOptions } from "@/components/chatOptions";
import { type Translate, useT } from "@/components/i18n";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/components/locales";
import { THEME_NAMES, usePreferences } from "@/components/preferences";
import { useSettings } from "@/components/settings";
import { Choice, control, Group, Row, Segmented } from "@/components/settingsControls";
import { DeleteAccountRow, DevicesGroup } from "@/components/settingsDevices";
import { UsageGroup } from "@/components/settingsUsage";
import { useShortcuts } from "@/components/shortcuts";
import { useSignIn } from "@/components/signIn";
import { useKeyNames } from "@/lib/keys";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/messages/en";
import { ANSWER_FONTS, PALETTES, THEMES } from "@sirathic/app/preferences";
import { MODES } from "@sirathic/server/messages";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, UserIcon } from "@hugeicons/core-free-icons";
import { type FC, useEffect, useState } from "react";

const chosenLocale = (): "auto" | Locale =>
  LOCALES.find((code) => document.cookie.split("; ").includes(`${LOCALE_COOKIE}=${code}`)) ??
  "auto";

const switchLocale = (next: "auto" | Locale) => {
  document.cookie =
    next === "auto"
      ? `${LOCALE_COOKIE}=; path=/; max-age=0`
      : `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
};

const LOCALE_NAMES = {
  en: "English",
  ar: "العربية",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  ru: "Русский",
  tr: "Türkçe",
  az: "Azərbaycanca",
  bs: "Bosanski",
  sr: "Српски",
  sl: "Slovenščina",
  uz: "Ўзбекча",
  ky: "Кыргызча",
  id: "Bahasa Indonesia",
  tl: "Tagalog",
  zh: "中文",
  ug: "ئۇيغۇرچە",
  ja: "日本語",
  vi: "Tiếng Việt",
  th: "ไทย",
  km: "ខ្មែរ",
  fa: "فارسی",
  ku: "کوردی",
  ps: "پښتو",
  hi: "हिन्दी",
  bn: "বাংলা",
  te: "తెలుగు",
  ml: "മലയാളം",
  as: "অসমীয়া",
  ta: "தமிழ்",
  si: "සිංහල",
  ff: "Fulfulde",
  sw: "Kiswahili",
} satisfies Record<Locale, string>;
const interfaceLanguageName = (t: Translate) => (code: "auto" | Locale) =>
  code === "auto" ? t("Same as my browser") : LOCALE_NAMES[code];

const LanguageRow: FC = () => {
  const [language] = useState(chosenLocale);
  const t = useT();
  return (
    <Row label={t("Language")} hint={t("The language of Sirathic's menus and buttons")}>
      <Choice
        label={t("Language")}
        value={language}
        options={["auto", ...LOCALES]}
        nameOf={interfaceLanguageName(t)}
        onChange={switchLocale}
      />
    </Row>
  );
};

export const AccountSection: FC = () => {
  const status = useAccount((s) => s.status);
  const modelsError = useAccount((s) => s.modelsError);
  const signOut = useAccount((s) => s.signOut);
  const ask = useSignIn((s) => s.ask);
  const setOpen = useSettings((s) => s.setOpen);
  const t = useT();

  return (
    <>
      <Group>
        {status?.signedIn === true ? (
          <div className="flex items-center gap-3 py-1">
            {status.image ? (
              <img
                src={status.image}
                alt=""
                referrerPolicy="no-referrer"
                className="size-9 shrink-0 rounded-full"
              />
            ) : (
              <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full">
                <HugeiconsIcon icon={UserIcon} className="size-4" />
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm">
                {status.label ?? t(status.via === "google" ? "Google account" : "ChatGPT account")}
              </span>
              <span className="text-muted-foreground text-[13px]">
                {t(status.via === "google" ? "Signed in with Google" : "Signed in with ChatGPT")}
              </span>
            </div>
            <button type="button" onClick={() => void signOut()} className={control}>
              {t("Sign out")}
            </button>
          </div>
        ) : (
          <Row label={t("Not signed in")} hint={t("Sign in to ask and keep your chats")}>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                ask();
              }}
              className={cn(
                control,
                "bg-primary text-primary-foreground border-0 hover:opacity-90",
              )}
            >
              {t("Sign in")}
            </button>
          </Row>
        )}
      </Group>
      <Group>
        <LanguageRow />
      </Group>
      {status?.signedIn === true && (
        <>
          <UsageGroup />
          <DevicesGroup />
          <Group>
            <DeleteAccountRow />
          </Group>
        </>
      )}
      {modelsError && (
        <p className="text-destructive mt-3 flex items-center gap-1.5 text-xs">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 shrink-0" />
          {modelsError}
        </p>
      )}
    </>
  );
};

type Theme = (typeof THEMES)[number];
type Palette = (typeof PALETTES)[number];

const SKETCH_TONES = {
  light: { page: "bg-white", side: "bg-[#f4f4f4]", line: "bg-[#d9d9d9]" },
  dark: { page: "bg-[#161616]", side: "bg-[#1c1c1c]", line: "bg-[#3a3a3a]" },
} as const;

const ThemeSketch: FC<{ tone: keyof typeof SKETCH_TONES }> = ({ tone }) => {
  const { page, side, line } = SKETCH_TONES[tone];
  return (
    <span className={cn("absolute inset-0 flex", page)}>
      <span className={cn("w-[28%]", side)} />
      <span className="flex flex-1 flex-col gap-1.5 p-2.5">
        <span className={cn("h-1.5 w-3/4 rounded-full", line)} />
        <span className={cn("h-1.5 w-1/2 rounded-full", line)} />
        <span className={cn("mt-auto h-3 rounded-[4px]", line)} />
      </span>
    </span>
  );
};

const ThemePictures: FC<{ value: Theme; onChange: (next: Theme) => void }> = ({
  value,
  onChange,
}) => {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t("Theme")} className="flex w-full gap-2.5 md:w-auto">
      {THEMES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          onClick={() => onChange(option)}
          className="group flex flex-1 flex-col items-center gap-1.5 md:w-[98px] md:flex-none"
        >
          <span
            className={cn(
              "relative h-16 w-full overflow-hidden rounded-[10px] border transition-colors",
              option === value
                ? "border-foreground/60 ring-foreground/60 ring-1"
                : "border-foreground/10 group-hover:border-foreground/30",
            )}
          >
            <ThemeSketch tone={option === "dark" ? "dark" : "light"} />
            {option === "system" && (
              <span className="absolute inset-0 [clip-path:inset(0_0_0_50%)]">
                <ThemeSketch tone="dark" />
              </span>
            )}
          </span>
          <span
            className={cn(
              "text-[13px]",
              option === value ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {t(THEME_NAMES[option])}
          </span>
        </button>
      ))}
    </div>
  );
};

const PALETTE_NAMES = {
  sirathic: "Sirathic",
  grove: "Grove",
  ocean: "Ocean",
  ember: "Ember",
  iris: "Iris",
  rose: "Rose",
} satisfies Record<Palette, MessageKey>;

const PalettePictures: FC<{ value: Palette; onChange: (next: Palette) => void }> = ({
  value,
  onChange,
}) => {
  const t = useT();
  return (
    <div
      role="radiogroup"
      aria-label={t("Colors")}
      className="grid w-full grid-cols-3 gap-2.5 md:w-80"
    >
      {PALETTES.map((palette) => (
        <button
          key={palette}
          type="button"
          role="radio"
          aria-checked={palette === value}
          onClick={() => onChange(palette)}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-[10px] border py-2.5 transition-colors",
            palette === value
              ? "border-foreground/60 ring-foreground/60 ring-1"
              : "border-foreground/10 hover:border-foreground/30",
          )}
        >
          <span className="ring-foreground/15 flex size-10 overflow-hidden rounded-full ring-1">
            {(["light", "dark"] as const).map((mode) => (
              <span
                key={mode}
                data-mode={mode}
                data-palette={palette}
                className="bg-background relative flex-1"
              >
                <span className="bg-super absolute start-0.5 top-2.5 size-3.5 rounded-full blur-xs" />
              </span>
            ))}
          </span>
          <span
            className={cn(
              "text-[13px]",
              palette === value ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {t(PALETTE_NAMES[palette])}
          </span>
        </button>
      ))}
    </div>
  );
};

const FONT_NAMES = { sans: "Sans", serif: "Serif" } satisfies Record<
  (typeof ANSWER_FONTS)[number],
  MessageKey
>;

export const AppearanceSection: FC = () => {
  const theme = usePreferences((s) => s.theme);
  const answerFont = usePreferences((s) => s.answerFont);
  const palette = usePreferences((s) => s.palette);
  const change = usePreferences((s) => s.change);
  const t = useT();

  return (
    <Group>
      <Row label={t("Theme")}>
        <ThemePictures value={theme} onChange={(next) => change({ theme: next })} />
      </Row>
      <Row label={t("Colors")}>
        <PalettePictures value={palette} onChange={(next) => change({ palette: next })} />
      </Row>
      <Row label={t("Answer font")} hint={t("How answers look")}>
        <Segmented
          label={t("Answer font")}
          value={answerFont}
          options={ANSWER_FONTS.map((value) => ({ value, label: FONT_NAMES[value] }))}
          onChange={(next) => change({ answerFont: next })}
        />
      </Row>
    </Group>
  );
};

const TimezoneRow: FC = () => {
  const [zone, setZone] = useState<string>();
  const t = useT();

  useEffect(() => {
    void api.settings.get.query().then(
      (loaded) => setZone(loaded.timezone),
      () => undefined,
    );
  }, []);

  if (zone === undefined) return null;
  const here = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <Row label={t("Timezone for routines")} hint={t("Routines run on this clock")}>
      <Choice
        label={t("Timezone for routines")}
        value={zone}
        options={["", ...Intl.supportedValuesOf("timeZone")]}
        nameOf={(option) =>
          option ? option.replaceAll("_", " ") : t("Same as this device ({zone})", { zone: here })
        }
        onChange={(next) => {
          setZone(next);
          void api.settings.update.mutate({ timezone: next });
        }}
      />
    </Row>
  );
};

export const BehaviorSection: FC = () => {
  const mode = useChatOptions((s) => s.defaultMode);
  const setMode = useChatOptions((s) => s.setDefaultMode);
  const keys = useKeyNames();
  const t = useT();

  return (
    <>
      <Group>
        <Row label={t("Default mode")} hint={t(MODE_DETAILS[mode].description)}>
          <Segmented
            label={t("Default mode")}
            value={mode}
            options={MODES.map((value) => ({
              value,
              label: MODE_DETAILS[value].name,
            }))}
            onChange={setMode}
          />
        </Row>
        <TimezoneRow />
      </Group>
      <Group>
        <Row label={t("Keyboard shortcuts")}>
          <button
            type="button"
            onClick={() => useShortcuts.getState().setOpen(true)}
            className={control}
          >
            {keys.mod} /
          </button>
        </Row>
      </Group>
    </>
  );
};
