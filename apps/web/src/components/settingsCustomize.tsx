"use client";

import { useT } from "@/components/i18n";
import { Choice, control, Group, Row } from "@/components/settingsControls";
import { RulesGroup } from "@/components/settingsRules";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/messages/en";
import { type Draft, draftOf, sameDraft } from "@sirathic/app/customize";
import { MADHABS } from "@sirathic/server/settings";
import { type FC, useEffect, useState } from "react";

const MADHAB_NAMES = {
  none: "No preference",
  hanafi: "Hanafi",
  maliki: "Maliki",
  shafii: "Shafi'i",
  hanbali: "Hanbali",
} satisfies Record<(typeof MADHABS)[number], MessageKey>;

const INSTRUCTIONS_LIMIT = 1500;
const NAME_LIMIT = 80;
const ABOUT_LIMIT = 500;

export const CustomizeSection: FC = () => {
  const [saved, setSaved] = useState<Draft>();
  const [draft, setDraft] = useState<Draft>();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = useT();

  useEffect(() => {
    let current = true;
    api.settings.get.query().then(
      (loaded) => {
        if (!current) return;
        setSaved(draftOf(loaded));
        setDraft(draftOf(loaded));
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
  if (!saved || !draft) return null;

  const changed = !sameDraft(draft, saved);
  const edit = (update: Partial<Draft>) => setDraft({ ...draft, ...update });
  const save = () => {
    const next = draftOf(draft);
    setSaving(true);
    api.settings.update.mutate(next).then(
      () => {
        setSaved(next);
        setDraft(next);
        setSaving(false);
      },
      () => setSaving(false),
    );
  };

  return (
    <>
      <Group>
        <Row label={t("What should Sirathic call you?")}>
          <input
            value={draft.name}
            maxLength={NAME_LIMIT}
            onChange={(event) => edit({ name: event.target.value })}
            placeholder={t("Your name")}
            className="border-foreground/10 placeholder:text-muted-foreground h-8 w-[220px] rounded-[12px] border bg-transparent px-3 text-sm outline-none"
          />
        </Row>
        <div className="flex flex-col gap-2 py-3">
          <label htmlFor="about-you" className="text-sm">
            {t("About you")}
          </label>
          <textarea
            id="about-you"
            value={draft.about}
            maxLength={ABOUT_LIMIT}
            onChange={(event) => edit({ about: event.target.value })}
            placeholder={t("Your work, your studies, what you already know")}
            className="border-foreground/10 placeholder:text-muted-foreground h-20 w-full resize-none rounded-[12px] border bg-transparent px-3 py-2.5 text-sm outline-none"
          />
        </div>
        <Row
          label={t("Madhab")}
          hint={t("Fiqh answers lead with this school and still show the others")}
        >
          <Choice
            label={t("Madhab")}
            value={draft.madhab}
            options={MADHABS}
            nameOf={(madhab) => t(MADHAB_NAMES[madhab])}
            onChange={(madhab) => edit({ madhab })}
          />
        </Row>
        <div className="flex flex-col gap-2 py-3">
          <label htmlFor="custom-instructions" className="text-sm">
            {t("Custom instructions")}
          </label>
          <textarea
            id="custom-instructions"
            value={draft.instructions}
            maxLength={INSTRUCTIONS_LIMIT}
            onChange={(event) => edit({ instructions: event.target.value })}
            placeholder={t(
              "Anything Sirathic should keep in mind, like how much you know or how you like answers",
            )}
            className="border-foreground/10 placeholder:text-muted-foreground h-28 w-full resize-none rounded-[12px] border bg-transparent px-3 py-2.5 text-sm outline-none"
          />
          <span className="text-muted-foreground self-end text-[11px]">
            {draft.instructions.length} / {INSTRUCTIONS_LIMIT}
          </span>
        </div>
      </Group>
      <RulesGroup rules={draft.rules} onChange={(rules) => edit({ rules })} />
      <div className="flex justify-end pt-1">
        <button
          type="button"
          disabled={!changed || saving}
          onClick={save}
          className={cn(
            control,
            "bg-primary text-primary-foreground border-0 hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground disabled:hover:opacity-100",
          )}
        >
          {changed ? t("Save") : t("Saved")}
        </button>
      </div>
    </>
  );
};
