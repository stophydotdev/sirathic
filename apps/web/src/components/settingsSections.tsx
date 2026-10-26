"use client";

import { useAccount } from "@/components/account";
import { MODE_DETAILS, useChatOptions } from "@/components/chatOptions";
import { type Translate, useT } from "@/components/i18n";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/components/locales";
import { THEME_NAMES, THEMES, usePreferences } from "@/components/preferences";
import { useSettings } from "@/components/settings";
import { Choice, control, Group, Row, Segmented, Toggle } from "@/components/settingsControls";
import { useShortcuts } from "@/components/shortcuts";
import { useSignIn } from "@/components/signIn";
import { useKeyNames } from "@/lib/keys";
import { cn } from "@/lib/utils";
import { MODES } from "@sirathic/server/messages";
import { IconAlertCircle, IconUser } from "@tabler/icons-react";
import { type FC, useState } from "react";

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
                <IconUser className="size-4" />
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
      {modelsError && (
        <p className="text-destructive mt-3 flex items-center gap-1.5 text-xs">
          <IconAlertCircle className="size-3.5 shrink-0" />
          {modelsError}
        </p>
      )}
    </>
  );
};

type Theme = (typeof THEMES)[number];

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

export const AppearanceSection: FC = () => {
  const theme = usePreferences((s) => s.theme);
  const change = usePreferences((s) => s.change);
  const t = useT();

  return (
    <Group>
      <Row label={t("Theme")}>
        <ThemePictures value={theme} onChange={(next) => change({ theme: next })} />
      </Row>
    </Group>
  );
};

export const BehaviorSection: FC = () => {
  const autosuggest = usePreferences((s) => s.autosuggest);
  const change = usePreferences((s) => s.change);
  const mode = useChatOptions((s) => s.mode);
  const setMode = useChatOptions((s) => s.setMode);
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
      </Group>
      <Group>
        <Row
          label={t("Suggestions while typing")}
          hint={t("Show suggested questions under the box")}
        >
          <Toggle
            label={t("Suggestions while typing")}
            checked={autosuggest}
            onChange={(on) => change({ autosuggest: on })}
          />
        </Row>
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
