"use client";

import { useAccount } from "@/components/account";
import { MODE_DETAILS, useChatOptions } from "@/components/chat-options";
import {
  browserLocale,
  type Translate,
  useLocale,
  useLocalePath,
  useT,
} from "@/components/i18n";
import {
  LOCALE_COOKIE,
  LOCALES,
  type Locale,
  type PlainKey,
} from "@/components/locales";
import { MakerIcon } from "@/components/maker-icon";
import { THEME_NAMES, THEMES, usePreferences } from "@/components/preferences";
import { useSettings } from "@/components/settings";
import { useSignIn } from "@/components/sign-in";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/messages/en";
import { useSessions } from "@/components/sessions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/trpc";
import { MODES } from "@sirathic/server/messages";
import {
  ANSWER_LANGUAGES,
  ANSWER_LENGTHS,
  MADHABS,
  type Settings,
} from "@sirathic/server/settings";
import {
  AlertCircle,
  ArrowUpRight,
  CheckIcon,
  ChevronDownIcon,
} from "lucide-react";
import { Switch } from "radix-ui";
import { type FC, type ReactNode, useEffect, useRef, useState } from "react";

const control =
  "border-border hover:bg-muted flex h-[34px] shrink-0 items-center justify-center gap-1.5 rounded-[8px] border px-3 text-sm font-[470] transition-colors";

const Group: FC<{ title?: string; children: ReactNode }> = ({
  title,
  children,
}) => (
  <section className="mt-4 flex flex-col gap-2 first:mt-0">
    {title && <h2 className="text-muted-foreground text-[13px]">{title}</h2>}
    <div className="bg-card border-foreground/6 divide-foreground/6 divide-y rounded-[12px] border">
      {children}
    </div>
  </section>
);

const Row: FC<{ label: string; hint?: string; children?: ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <div className="flex min-h-[58px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-sm">{label}</span>
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </div>
    {children}
  </div>
);

function Segmented<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: readonly { value: Value; label: PlainKey }[];
  onChange: (next: Value) => void;
}) {
  const t = useT();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="border-border flex rounded-[8px] border p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-[28px] rounded-[6px] px-3 text-sm transition-colors",
            option.value === value
              ? "bg-foreground/12 text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(option.label)}
        </button>
      ))}
    </div>
  );
}

const Toggle: FC<{
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <Switch.Root
    aria-label={label}
    checked={checked}
    onCheckedChange={onChange}
    className="bg-foreground/15 data-[state=checked]:bg-super relative h-[22px] w-10 shrink-0 rounded-full transition-colors"
  >
    <Switch.Thumb className="bg-background block size-4 translate-x-[3px] rounded-full transition-transform data-[state=checked]:translate-x-[21px] rtl:-translate-x-[3px] rtl:data-[state=checked]:-translate-x-[21px]" />
  </Switch.Root>
);

function Choice<Value extends string>({
  label,
  value,
  options,
  nameOf,
  onChange,
}: {
  label: string;
  value: Value;
  options: readonly Value[];
  nameOf: (value: Value) => string;
  onChange: (next: Value) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className={cn(control, "w-[220px] justify-between font-normal")}
      >
        {nameOf(value)}
        <ChevronDownIcon className="text-muted-foreground size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px]">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            const picked = options.find((option) => option === next);
            if (picked) onChange(picked);
          }}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {nameOf(option)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const MADHAB_NAMES = {
  none: "No preference",
  hanafi: "Hanafi",
  maliki: "Maliki",
  shafii: "Shafi'i",
  hanbali: "Hanbali",
} satisfies Record<(typeof MADHABS)[number], MessageKey>;

const languageName = (code: string, inLanguage: string) =>
  new Intl.DisplayNames([inLanguage], { type: "language" }).of(code) ?? code;

const answerLanguageName =
  (t: Translate, locale: Locale) => (code: (typeof ANSWER_LANGUAGES)[number]) =>
    code === "auto" ? t("Same as my question") : languageName(code, locale);

const chosenLocale = (): "auto" | Locale =>
  LOCALES.find((code) =>
    document.cookie.split("; ").includes(`${LOCALE_COOKIE}=${code}`),
  ) ?? "auto";

const switchLocale = (next: "auto" | Locale) => {
  document.cookie =
    next === "auto"
      ? `${LOCALE_COOKIE}=; path=/; max-age=0`
      : `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  const target = next === "auto" ? browserLocale() : next;
  const { pathname, search, hash } = window.location;
  window.location.assign(
    `${pathname.replace(/^\/[^/]+/u, `/${target}`)}${search}${hash}`,
  );
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

const LENGTH_NAMES = {
  short: "Short",
  default: "Default",
  detailed: "Detailed",
} satisfies Record<(typeof ANSWER_LENGTHS)[number], MessageKey>;

const INSTRUCTIONS_LIMIT = 1500;
const NAME_LIMIT = 80;

export const AccountSection: FC = () => {
  const status = useAccount((s) => s.status);
  const modelsError = useAccount((s) => s.modelsError);
  const signOut = useAccount((s) => s.signOut);
  const ask = useSignIn((s) => s.ask);
  const setOpen = useSettings((s) => s.setOpen);
  const t = useT();

  if (status?.signedIn !== true) {
    return (
      <Group>
        <Row
          label={t("Not signed in")}
          hint={t("Sign in to ask and keep your chats")}
        >
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
      </Group>
    );
  }

  return (
    <>
      <Group>
        <Row
          label={t("Signed in with ChatGPT")}
          hint={status.label ?? t("Your ChatGPT account")}
        />
        <Row label={t("Sign out")} hint={t("Signs you out on this browser")}>
          <button
            type="button"
            onClick={() => void signOut()}
            className={control}
          >
            {t("Sign out")}
          </button>
        </Row>
      </Group>
      {modelsError && (
        <p className="text-destructive mt-3 flex items-center gap-1.5 text-xs">
          <AlertCircle className="size-3.5 shrink-0" />
          {modelsError}
        </p>
      )}
    </>
  );
};

export const PreferencesSection: FC = () => {
  const theme = usePreferences((s) => s.theme);
  const autosuggest = usePreferences((s) => s.autosuggest);
  const change = usePreferences((s) => s.change);
  const mode = useChatOptions((s) => s.mode);
  const setMode = useChatOptions((s) => s.setMode);
  const [language] = useState(chosenLocale);
  const t = useT();

  return (
    <>
      <Group title={t("Appearance")}>
        <Row
          label={t("Language")}
          hint={t("The language of Sirathic's menus and buttons")}
        >
          <Choice
            label={t("Language")}
            value={language}
            options={["auto", ...LOCALES]}
            nameOf={interfaceLanguageName(t)}
            onChange={switchLocale}
          />
        </Row>
        <Row label={t("Theme")} hint={t("How Sirathic looks on this device")}>
          <Segmented
            label={t("Theme")}
            value={theme}
            options={THEMES.map((value) => ({
              value,
              label: THEME_NAMES[value],
            }))}
            onChange={(next) => change({ theme: next })}
          />
        </Row>
      </Group>
      <Group title={t("Asking")}>
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
    </>
  );
};

export const PersonalizationSection: FC = () => {
  const [saved, setSaved] = useState<Settings>();
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const latest = useRef<Settings>(undefined);
  const queue = useRef(Promise.resolve());
  const t = useT();
  const locale = useLocale();

  useEffect(() => {
    let current = true;
    api.settings.get.query().then(
      (loaded) => {
        if (!current) return;
        latest.current = loaded;
        setSaved(loaded);
        setName(loaded.name);
        setInstructions(loaded.instructions);
      },
      () => {
        if (current) setFailed(true);
      },
    );
    return () => {
      current = false;
    };
  }, []);

  if (failed) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("Sign in to personalize answers.")}
      </p>
    );
  }
  if (!saved) return null;

  const save = (update: Partial<Settings>) => {
    const next: Settings = { ...(latest.current ?? saved), ...update };
    latest.current = next;
    setSaved(next);
    queue.current = queue.current.then(() =>
      api.settings.update.mutate(next).then(
        () => undefined,
        () => undefined,
      ),
    );
  };

  return (
    <>
      <Group>
        <Row label={t("What should Sirathic call you?")}>
          <input
            value={name}
            maxLength={NAME_LIMIT}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              if (name.trim() !== saved.name) save({ name: name.trim() });
            }}
            placeholder={t("Your name")}
            className="border-border placeholder:text-muted-foreground h-[34px] w-[220px] rounded-[8px] border bg-transparent px-3 text-sm outline-none"
          />
        </Row>
        <Row
          label={t("Madhab")}
          hint={t(
            "Fiqh answers lead with this school and still show the others",
          )}
        >
          <Choice
            label={t("Madhab")}
            value={saved.madhab}
            options={MADHABS}
            nameOf={(madhab) => t(MADHAB_NAMES[madhab])}
            onChange={(madhab) => save({ madhab })}
          />
        </Row>
        <div className="flex flex-col gap-2 px-4 py-3">
          <label htmlFor="custom-instructions" className="text-sm">
            {t("Custom instructions")}
          </label>
          <textarea
            id="custom-instructions"
            value={instructions}
            maxLength={INSTRUCTIONS_LIMIT}
            onChange={(event) => setInstructions(event.target.value)}
            onBlur={() => {
              if (instructions.trim() !== saved.instructions) {
                save({ instructions: instructions.trim() });
              }
            }}
            placeholder={t(
              "Anything Sirathic should keep in mind, like how much you know or how you like answers",
            )}
            className="border-border placeholder:text-muted-foreground h-28 w-full resize-none rounded-[8px] border bg-transparent px-3 py-2.5 text-sm outline-none"
          />
          <span className="text-muted-foreground self-end text-[11px]">
            {instructions.length} / {INSTRUCTIONS_LIMIT}
          </span>
        </div>
      </Group>
      <Group title={t("Answers")}>
        <Row label={t("Answer language")}>
          <Choice
            label={t("Answer language")}
            value={saved.answerLanguage}
            options={ANSWER_LANGUAGES}
            nameOf={answerLanguageName(t, locale)}
            onChange={(answerLanguage) => save({ answerLanguage })}
          />
        </Row>
        <Row label={t("Answer length")}>
          <Segmented
            label={t("Answer length")}
            value={saved.answerLength}
            options={ANSWER_LENGTHS.map((value) => ({
              value,
              label: LENGTH_NAMES[value],
            }))}
            onChange={(answerLength) => save({ answerLength })}
          />
        </Row>
        <Row
          label={t("Show Arabic text")}
          hint={t("Quote verses and hadith in Arabic next to the translation")}
        >
          <Toggle
            label={t("Show Arabic text")}
            checked={saved.showArabic}
            onChange={(showArabic) => save({ showArabic })}
          />
        </Row>
      </Group>
    </>
  );
};

function download(fileName: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export const DataSection: FC = () => {
  const incognitoByDefault = usePreferences((s) => s.incognitoByDefault);
  const change = usePreferences((s) => s.change);
  const refresh = useSessions((s) => s.refresh);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = useT();
  const href = useLocalePath();

  const exportChats = async () => {
    setBusy(true);
    const chats = await api.sessions.export.query().catch(() => undefined);
    setBusy(false);
    if (!chats) return;
    const day = new Date().toISOString().slice(0, 10);
    download(`sirathic-chats-${day}.json`, JSON.stringify(chats, null, 2));
  };

  const deleteAll = async () => {
    setBusy(true);
    await api.sessions.removeAll.mutate().catch(() => undefined);
    await refresh();
    setBusy(false);
    setConfirming(false);
    if (window.location.pathname.startsWith(href("/s/"))) {
      window.location.assign(href("/"));
    }
  };

  return (
    <Group>
      <Row
        label={t("Incognito by default")}
        hint={t("New chats start in incognito and aren't saved")}
      >
        <Toggle
          label={t("Incognito by default")}
          checked={incognitoByDefault}
          onChange={(on) => change({ incognitoByDefault: on })}
        />
      </Row>
      <Row
        label={t("Export my chats")}
        hint={t("Download every saved chat as a file")}
      >
        <button
          type="button"
          disabled={busy}
          onClick={() => void exportChats()}
          className={cn(control, "disabled:opacity-60")}
        >
          {t("Export")}
        </button>
      </Row>
      <Row
        label={t("Delete all chats")}
        hint={
          confirming
            ? t("Delete every saved chat? This can't be undone.")
            : t("Removes every saved chat")
        }
      >
        {confirming ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={control}
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void deleteAll()}
              className={cn(
                control,
                "bg-destructive border-0 text-white hover:opacity-90 disabled:opacity-60",
              )}
            >
              {t("Delete all")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={cn(control, "text-destructive")}
          >
            {t("Delete all")}
          </button>
        )}
      </Row>
    </Group>
  );
};

export const ModelsSection: FC = () => {
  const status = useAccount((s) => s.status);
  const models = useAccount((s) => s.models);
  const chosen = useAccount((s) => s.chosen) ?? models[0]?.slug;
  const choose = useAccount((s) => s.choose);
  const t = useT();

  return (
    <Group
      title={status?.signedIn ? t("From your ChatGPT account") : undefined}
    >
      {models.length === 0 && <Row label={t("Sign in to see your models")} />}
      {models.map((model) => (
        <button
          key={model.slug}
          type="button"
          aria-pressed={model.slug === chosen}
          onClick={() => choose(model.slug)}
          className="hover:bg-muted/60 flex min-h-[52px] w-full items-center gap-3 px-4 text-start text-sm first:rounded-t-[12px] last:rounded-b-[12px]"
        >
          <MakerIcon maker={model.maker} className="size-4 shrink-0" />
          <span className="flex-1">{model.name}</span>
          {model.slug === chosen && <CheckIcon className="size-4" />}
        </button>
      ))}
    </Group>
  );
};

const SOURCE_CREDITS = [
  { label: "Qur'an text", name: "Tanzil Project", href: "https://tanzil.net" },
  { label: "Verse links", name: "Quran.com", href: "https://quran.com" },
  { label: "Hadith", name: "Sunnah.com", href: "https://sunnah.com" },
  {
    label: "Hadith explanations",
    name: "HadeethEnc",
    href: "https://hadeethenc.com",
  },
  { label: "Fiqh", name: "IslamLab Islamic sciences", href: undefined },
  { label: "Web search", name: "Stophy", href: undefined },
] satisfies readonly { label: MessageKey; name: string; href?: string }[];

export const AboutSection: FC = () => {
  const t = useT();
  return (
    <Group title={t("Sources")}>
      {SOURCE_CREDITS.map((credit) => (
        <Row key={credit.label} label={t(credit.label)}>
          {credit.href ? (
            <a
              href={credit.href}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
            >
              {credit.name}
              <ArrowUpRight className="size-3.5" />
            </a>
          ) : (
            <span className="text-muted-foreground text-sm">{credit.name}</span>
          )}
        </Row>
      ))}
    </Group>
  );
};
