"use client";

import { type Translate, useLocale, useT } from "@/components/i18n";
import type { Locale } from "@/components/locales";
import { Choice, Group, Row, Segmented, Toggle } from "@/components/settingsControls";
import { api } from "@/lib/trpc";
import type { MessageKey } from "@/messages/en";
import {
  ANSWER_LANGUAGES,
  ANSWER_LENGTHS,
  MADHABS,
  type Settings,
} from "@sirathic/server/settings";
import { type FC, useEffect, useRef, useState } from "react";

const MADHAB_NAMES = {
  none: "No preference",
  hanafi: "Hanafi",
  maliki: "Maliki",
  shafii: "Shafi'i",
  hanbali: "Hanbali",
} satisfies Record<(typeof MADHABS)[number], MessageKey>;

const LENGTH_NAMES = {
  short: "Short",
  default: "Default",
  detailed: "Detailed",
} satisfies Record<(typeof ANSWER_LENGTHS)[number], MessageKey>;

const languageName = (code: string, inLanguage: string) =>
  new Intl.DisplayNames([inLanguage], { type: "language" }).of(code) ?? code;

const answerLanguageName =
  (t: Translate, locale: Locale) => (code: (typeof ANSWER_LANGUAGES)[number]) =>
    code === "auto" ? t("Same as my question") : languageName(code, locale);

const INSTRUCTIONS_LIMIT = 1500;
const NAME_LIMIT = 80;

export const CustomizeSection: FC = () => {
  const [saved, setSaved] = useState<Settings>();
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const queue = useRef(Promise.resolve());
  const t = useT();
  const locale = useLocale();

  useEffect(() => {
    let current = true;
    api.settings.get.query().then(
      (loaded) => {
        if (!current) return;
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
    return <p className="text-muted-foreground text-sm">{t("Sign in to customize answers.")}</p>;
  }
  if (!saved) return null;

  const save = (update: Partial<Settings>) => {
    setSaved((current) => current && { ...current, ...update });
    queue.current = queue.current.then(() =>
      api.settings.update.mutate(update).then(
        () => undefined,
        () => undefined,
      ),
    );
  };

  return (
    <>
      <Group title={t("Answers")}>
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
        <Row label={t("Answer language")}>
          <Choice
            label={t("Answer language")}
            value={saved.answerLanguage}
            options={ANSWER_LANGUAGES}
            nameOf={answerLanguageName(t, locale)}
            onChange={(answerLanguage) => save({ answerLanguage })}
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
            className="border-foreground/10 placeholder:text-muted-foreground h-8 w-[220px] rounded-[12px] border bg-transparent px-3 text-sm outline-none"
          />
        </Row>
        <Row
          label={t("Madhab")}
          hint={t("Fiqh answers lead with this school and still show the others")}
        >
          <Choice
            label={t("Madhab")}
            value={saved.madhab}
            options={MADHABS}
            nameOf={(madhab) => t(MADHAB_NAMES[madhab])}
            onChange={(madhab) => save({ madhab })}
          />
        </Row>
        <div className="flex flex-col gap-2 py-3">
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
            className="border-foreground/10 placeholder:text-muted-foreground h-28 w-full resize-none rounded-[12px] border bg-transparent px-3 py-2.5 text-sm outline-none"
          />
          <span className="text-muted-foreground self-end text-[11px]">
            {instructions.length} / {INSTRUCTIONS_LIMIT}
          </span>
        </div>
      </Group>
    </>
  );
};
