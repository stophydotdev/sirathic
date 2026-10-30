"use client";

import { useT } from "@/components/i18n";
import { control, Group, Segmented } from "@/components/settingsControls";
import type { MessageKey } from "@/messages/en";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { RULE_CHARS, RULE_EFFECTS, RULE_LIMIT, type Settings } from "@sirathic/server/settings";
import { type FC, useState } from "react";

const EFFECT_NAMES = {
  allow: "Allow automatically",
  ask: "Ask first",
} satisfies Record<(typeof RULE_EFFECTS)[number], MessageKey>;

export const RulesGroup: FC<{
  rules: Settings["rules"];
  onChange: (next: Settings["rules"]) => void;
}> = ({ rules, onChange }) => {
  const [text, setText] = useState("");
  const [effect, setEffect] = useState<(typeof RULE_EFFECTS)[number]>("allow");
  const t = useT();

  const add = () => {
    const rule = { text: text.trim(), effect };
    if (
      rule.text === "" ||
      rules.some((have) => have.text === rule.text && have.effect === effect)
    ) {
      return;
    }
    onChange([...rules, rule]);
    setText("");
  };

  return (
    <Group title={t("Auto-review")}>
      <p className="text-muted-foreground py-2 text-[13px]">
        {t(
          "Sirathic asks before it sends, posts or deletes for you. Add a rule to let it act without asking. Ask first wins if rules conflict, and paying or refunding always asks.",
        )}
      </p>
      {rules.length > 0 && (
        <ul className="flex flex-col">
          {rules.map((rule, index) => (
            <li
              key={`${rule.effect}:${rule.text}`}
              className="border-foreground/6 flex items-center gap-3 border-t py-2.5 first:border-t-0"
            >
              <span className="min-w-0 flex-1 text-sm break-words">{rule.text}</span>
              <span className="text-muted-foreground shrink-0 text-[13px]">
                {t(EFFECT_NAMES[rule.effect])}
              </span>
              <button
                type="button"
                aria-label={t("Delete")}
                onClick={() => onChange(rules.filter((_, at) => at !== index))}
                className="text-muted-foreground hover:bg-muted hover:text-destructive flex size-7 shrink-0 items-center justify-center rounded-[8px] transition-colors"
              >
                <HugeiconsIcon icon={Delete02Icon} className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {rules.length < RULE_LIMIT && (
        <form
          className="flex flex-col gap-2 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <label htmlFor="rule-text" className="text-sm">
            {t("When Sirathic wants to")}
          </label>
          <input
            id="rule-text"
            value={text}
            maxLength={RULE_CHARS}
            onChange={(event) => setText(event.target.value)}
            placeholder={t("Reply to emails for me")}
            className="border-foreground/10 placeholder:text-muted-foreground h-8 w-full rounded-[12px] border bg-transparent px-3 text-sm outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented
              label={t("When Sirathic wants to")}
              value={effect}
              options={RULE_EFFECTS.map((value) => ({ value, label: EFFECT_NAMES[value] }))}
              onChange={setEffect}
            />
            <button type="submit" className={control}>
              {t("Add rule")}
            </button>
          </div>
        </form>
      )}
    </Group>
  );
};
