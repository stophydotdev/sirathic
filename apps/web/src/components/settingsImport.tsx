"use client";

import { useT } from "@/components/i18n";
import { importedFacts } from "@/components/memoryImport";
import { modalButton, modalPrimaryButton } from "@/components/sessionMenu";
import { api } from "@/lib/trpc";
import { type FC, useEffect, useState } from "react";

export const ImportMemory: FC<{ onClose: () => void }> = ({ onClose }) => {
  const [saved, setSaved] = useState<readonly string[]>();
  const [pasted, setPasted] = useState("");
  const [copied, setCopied] = useState(false);
  const t = useT();
  const prompt = t(
    "List every fact you know about me that would help another assistant answer me: my work, studies, where I live, my family, my goals and how I like answers. One fact per line, under 15 words each. No religious rulings, health or private struggles.",
  );

  useEffect(() => {
    void api.settings.get.query().then(
      (loaded) => setSaved(loaded.memory),
      () => setSaved([]),
    );
  }, []);

  const facts = importedFacts(pasted, saved ?? []);

  const add = async () => {
    await api.settings.update
      .mutate({ memory: [...(saved ?? []), ...facts] })
      .catch(() => undefined);
    onClose();
  };

  return (
    <>
      <p className="text-muted-foreground text-sm">
        {t("Copy this into ChatGPT, or the assistant you use")}
      </p>
      <div className="bg-muted flex items-start gap-2 rounded-[12px] p-3">
        <p className="text-muted-foreground flex-1 text-[13px]">{prompt}</p>
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(prompt).then(() => setCopied(true))}
          className={modalButton}
        >
          {copied ? t("Copied") : t("Copy")}
        </button>
      </div>
      <label htmlFor="imported-memory" className="text-muted-foreground text-sm">
        {t("Paste its answer")}
      </label>
      <textarea
        id="imported-memory"
        value={pasted}
        onChange={(event) => setPasted(event.target.value)}
        className="border-foreground/10 h-32 w-full resize-none rounded-[12px] border bg-transparent px-3 py-2.5 text-sm outline-none"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={modalButton}>
          {t("Cancel")}
        </button>
        <button
          type="button"
          disabled={facts.length === 0}
          onClick={() => void add()}
          className={modalPrimaryButton}
        >
          {facts.length === 1 ? t("Add 1 fact") : t("Add {count} facts", { count: facts.length })}
        </button>
      </div>
    </>
  );
};
