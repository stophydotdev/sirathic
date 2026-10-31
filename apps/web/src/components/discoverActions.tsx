"use client";

import { saveDraft } from "@/components/draft";
import { useT } from "@/components/i18n";
import { useStartChat } from "@/components/newChat";
import { Swap } from "@/components/swap";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowUp02Icon,
  Link01Icon,
  MoreHorizontalIcon,
  Share08Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
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

export const CardMenu: FC<{ title: string; slug: string }> = ({ title, slug }) => {
  const t = useT();
  const linkOf = () => `${window.location.origin}/discover/${slug}`;
  const share = () => {
    const shared = { title, url: linkOf() };
    if (navigator.canShare?.(shared)) void navigator.share(shared).catch(() => undefined);
    else void navigator.clipboard.writeText(shared.url);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("More actions")}
        className="text-muted-foreground hover:text-foreground flex size-7 items-center justify-center rounded-md transition-colors"
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onSelect={share}>
          <HugeiconsIcon icon={Share08Icon} className="size-4" />
          {t("Share")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigator.clipboard.writeText(linkOf())}>
          <HugeiconsIcon icon={Link01Icon} className="size-4" />
          {t("Copy link")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const TAB =
  "text-muted-foreground hover:text-foreground flex h-14 items-center gap-1 border-b-2 border-transparent text-sm transition-colors";

export const DiscoverTabs: FC<{ topics: string[]; chosen: string | undefined }> = ({
  topics,
  chosen,
}) => {
  const t = useT();
  return (
    <nav className="flex items-center gap-5">
      <Link href="/discover" className={cn(TAB, !chosen && "border-foreground text-foreground")}>
        {t("Top")}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(TAB, chosen && "border-foreground text-foreground")}>
          {chosen ?? t("Topics")}
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-44">
          {topics.map((topic) => (
            <DropdownMenuItem key={topic} asChild>
              <Link href={`/discover?topic=${encodeURIComponent(topic.toLowerCase())}`}>
                {topic}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
};
