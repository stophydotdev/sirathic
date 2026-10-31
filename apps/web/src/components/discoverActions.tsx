"use client";

import { saveDraft } from "@/components/draft";
import { useT } from "@/components/i18n";
import { useStartChat } from "@/components/newChat";
import { Swap } from "@/components/swap";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp02Icon, Share08Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { type FC, type FormEvent, useState } from "react";

const COPIED_MS = 2_000;

export const ShareLink: FC = () => {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    });

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="bg-foreground/10 hover:bg-foreground/15 flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-[470] transition-colors"
    >
      <Swap
        swapped={copied}
        from={<HugeiconsIcon icon={Share08Icon} className="size-4" />}
        to={<HugeiconsIcon icon={Tick02Icon} className="size-4" />}
      />
      {copied ? t("Copied") : t("Share")}
    </button>
  );
};

export const FollowUp: FC<{ title: string }> = ({ title }) => {
  const t = useT();
  const startChat = useStartChat();
  const [question, setQuestion] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const asked = question.trim();
    if (!asked) return;
    saveDraft(`“${title}”\n${asked}`);
    startChat();
  };

  return (
    <form
      onSubmit={submit}
      className="from-background via-background sticky bottom-0 bg-linear-to-t to-transparent px-4 pt-6 pb-4"
    >
      <label className="bg-muted border-border mx-auto flex max-w-180 items-center gap-3 rounded-2xl border py-2 ps-4 pe-2">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={t("Ask a follow-up")}
          className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none"
        />
        <button
          type="submit"
          disabled={!question.trim()}
          aria-label={t("Submit")}
          className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40"
        >
          <HugeiconsIcon icon={ArrowUp02Icon} className="size-4" />
        </button>
      </label>
    </form>
  );
};
