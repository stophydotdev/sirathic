"use client";

import { actionButton } from "@/components/answerActions";
import { useLocale, useT } from "@/components/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/messages/en";
import { HugeiconsIcon } from "@hugeicons/react";
import { SmileIcon } from "@hugeicons/core-free-icons";
import { defaultEmojiDataResolver, EmojiPicker } from "frimousse";
import { type FC, useState } from "react";

const QUICK_EMOJI = ["👍", "👎", "❤️", "😂", "🎉", "😮"] as const;

const CATEGORIES = [
  "Smileys & emotion",
  "People & body",
  undefined,
  "Animals & nature",
  "Food & drink",
  "Travel & places",
  "Activities",
  "Objects",
  "Symbols",
  "Flags",
] as const satisfies readonly (MessageKey | undefined)[];

const FullPicker: FC<{ pick: (emoji: string) => void }> = ({ pick }) => {
  const t = useT();
  const locale = useLocale();
  return (
    <EmojiPicker.Root
      locale={locale}
      columns={8}
      onEmojiSelect={({ emoji }) => pick(emoji)}
      resolveEmojiData={async (language, options) => {
        const data = await defaultEmojiDataResolver(language, options);
        return {
          ...data,
          categories: data.categories.map((category) =>
            Object.assign({}, category, {
              label: t(CATEGORIES[category.index] ?? "Objects"),
            }),
          ),
        };
      }}
      className="flex w-72 max-w-full flex-col gap-2"
    >
      <EmojiPicker.Search
        autoFocus
        aria-label={t("Search emoji")}
        placeholder={t("Search emoji")}
        className="bg-muted placeholder:text-muted-foreground focus-visible:ring-ring h-8 rounded-md px-2 text-sm outline-none focus-visible:ring-2"
      />
      <EmojiPicker.Viewport className="relative h-64 overflow-y-auto overscroll-contain">
        <EmojiPicker.Loading className="text-muted-foreground block p-3 text-xs">
          {t("Loading emoji…")}
        </EmojiPicker.Loading>
        <EmojiPicker.Empty className="text-muted-foreground block p-3 text-xs">
          {t("No emoji found")}
        </EmojiPicker.Empty>
        <EmojiPicker.List
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div {...props} className="bg-popover text-muted-foreground px-1 py-1.5 text-xs">
                {category.label}
              </div>
            ),
            Row: (props) => <div {...props} className="flex" />,
            Emoji: ({ emoji, ...props }) => (
              <button
                {...props}
                type="button"
                className="data-active:bg-muted grid size-8 flex-1 place-items-center rounded-md text-xl"
              >
                {emoji.emoji}
              </button>
            ),
          }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  );
};

export const BotReactionPicker: FC<{
  reaction: string | undefined;
  disabled: boolean;
  onPick: (emoji: string) => void;
}> = ({ reaction, disabled, onPick }) => {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const t = useT();
  const pick = (emoji: string) => {
    onPick(emoji);
    setOpen(false);
    setFull(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFull(false);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger
            disabled={disabled}
            aria-label={t("React")}
            className={cn(actionButton, "transition-none")}
          >
            <HugeiconsIcon icon={SmileIcon} className="size-4" />
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent className="animate-none!" side="top">
          {t("React")}
        </TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="center" className="w-auto animate-none! p-2">
        {full ? (
          <FullPicker pick={pick} />
        ) : (
          <div className="flex items-center gap-0.5">
            {QUICK_EMOJI.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={emoji}
                aria-pressed={reaction === emoji}
                onClick={() => pick(emoji)}
                className="hover:bg-muted focus-visible:ring-ring aria-pressed:bg-muted grid size-8 place-items-center rounded-md text-xl outline-none focus-visible:ring-2"
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              aria-label={t("Choose emoji")}
              title={t("Choose emoji")}
              onClick={() => setFull(true)}
              className={cn(actionButton, "size-8 transition-none")}
            >
              <HugeiconsIcon icon={SmileIcon} className="size-4" />
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
