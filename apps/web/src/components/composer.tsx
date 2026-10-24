"use client";

import { MODE_DETAILS, useChatOptions } from "@/components/chat-options";
import { takeDraft } from "@/components/draft";
import { useT } from "@/components/i18n";
import { useAccount } from "@/components/account";
import { ModelPicker } from "@/components/model-picker";
import { usePreferences } from "@/components/preferences";
import { useSignIn } from "@/components/sign-in";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAttachmentSrc } from "@/lib/hooks/use-attachment-src";
import { type Mode, MODES, mode as modeSchema } from "@sirathic/server/messages";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/messages/en";
import {
  AttachmentPrimitive,
  AuiIf,
  ComposerPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import {
  IconArrowUp,
  IconArrowUpLeft,
  IconChevronDown,
  IconClock,
  IconFile,
  IconPaperclip,
  IconPlus,
  IconSearch,
  IconSquare,
  IconTelescope,
  IconX,
} from "@tabler/icons-react";
import Image from "next/image";
import { type FC, type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";

const ROTATING = [
  "Ask anything…",
  "Type / for modes",
  "Type @ for sources",
] as const satisfies readonly MessageKey[];
const ROTATE_MS = 4_000;
const SUGGEST_DELAY_MS = 150;
const MIN_SUGGEST_CHARS = 2;

const finePointer = globalThis.matchMedia?.("(pointer: fine)").matches ?? false;

const iconButton =
  "text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-40";

const primaryButton =
  "bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-foreground/15 disabled:text-background flex size-8 shrink-0 items-center justify-center rounded-full transition-colors";

export const MODE_ICONS = {
  quick: <IconSearch className="size-4" />,
  research: <IconTelescope className="size-4" />,
} satisfies Record<Mode, ReactNode>;

type Suggestion = Awaited<ReturnType<typeof api.suggest.query>>[number];

type Choice = {
  key: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  choose: () => void;
  fill?: () => void;
};

function useRotatingPlaceholder(first: string, rotate: boolean) {
  const [index, setIndex] = useState(0);
  const t = useT();
  useEffect(() => {
    if (!rotate) return;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % ROTATING.length),
      ROTATE_MS,
    );
    return () => clearInterval(timer);
  }, [rotate]);
  const current = ROTATING[index];
  return rotate && current ? t(current) : first;
}

function useSuggestions(text: string, enabled: boolean) {
  const [found, setFound] = useState<Suggestion[]>([]);
  useEffect(() => {
    const query = text.trim();
    if (!enabled || query.length < MIN_SUGGEST_CHARS) {
      setFound([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api.suggest
        .query({ q: query }, { signal: controller.signal })
        .then(setFound)
        .catch(() => undefined);
    }, SUGGEST_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, enabled]);
  return found;
}

export const Composer: FC<{
  placeholder: string;
  menuSide: "top" | "bottom";
  rotate?: boolean;
}> = ({ placeholder, menuSide, rotate = false }) => {
  const aui = useAui();
  const text = useAuiState((s) => s.composer.text);
  const setMode = useChatOptions((s) => s.setMode);
  useEffect(() => {
    const draft = takeDraft();
    if (draft) aui.thread().composer().setText(draft);
  }, [aui]);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState(false);
  const signedOut = useAccount((s) => s.status?.signedIn === false);
  const ask = useSignIn((s) => s.ask);
  const shown = useRotatingPlaceholder(placeholder, rotate && text === "");
  const t = useT();

  const command = /^\/[^\s]*$/u.test(text) ? text : undefined;
  const autosuggest = usePreferences((s) => s.autosuggest);
  const suggestions = useSuggestions(text, autosuggest && focused && command === undefined);
  const composer = () => aui.thread().composer();

  const choices: Choice[] = command?.startsWith("/")
    ? MODES.filter((name) =>
        [MODE_DETAILS[name].name, t(MODE_DETAILS[name].name)].some((label) =>
          label.toLowerCase().startsWith(command.slice(1).toLowerCase()),
        ),
      ).map((name) => ({
        key: name,
        label: t(MODE_DETAILS[name].name),
        hint: t(MODE_DETAILS[name].description),
        icon: MODE_ICONS[name],
        choose: () => {
          setMode(name);
          composer().setText("");
        },
      }))
    : focused
      ? suggestions.map((suggestion) => ({
          key: suggestion.text,
          label: suggestion.text,
          icon: suggestion.past ? (
            <IconClock className="size-4" />
          ) : (
            <IconSearch className="size-4" />
          ),
          choose: () => {
            composer().setText(suggestion.text);
            if (signedOut) ask(suggestion.text);
            else composer().send();
          },
          fill: () => composer().setText(`${suggestion.text} `),
        }))
      : [];
  const selecting = command !== undefined || picked;
  const highlighted = selecting ? Math.min(active, Math.max(choices.length - 1, 0)) : -1;

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (signedOut && event.key === "Enter" && !event.shiftKey && !selecting) {
      event.preventDefault();
      ask(text);
      return;
    }
    if (choices.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const from = selecting ? highlighted : step > 0 ? -1 : 0;
      setActive((from + step + choices.length) % choices.length);
      setPicked(true);
    } else if (event.key === "Enter" && !event.shiftKey && selecting) {
      event.preventDefault();
      choices[highlighted]?.choose();
    } else if (event.key === "Tab" && choices[highlighted]?.fill) {
      event.preventDefault();
      choices[highlighted]?.fill?.();
    }
  };

  return (
    <div className="relative w-full">
      <ComposerPrimitive.Root className="bg-card border-foreground/10 flex w-full flex-col rounded-[20px] border pt-3">
        <AuiIf condition={(s) => s.composer.attachments.length > 0}>
          <div className="flex flex-wrap gap-2 px-4 pt-4">
            <ComposerPrimitive.Attachments>
              {() => <AttachmentPreview />}
            </ComposerPrimitive.Attachments>
          </div>
        </AuiIf>

        <ComposerPrimitive.Input
          rows={1}
          autoFocus={finePointer}
          placeholder={shown}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onChange={() => {
            setActive(0);
            setPicked(false);
          }}
          className="placeholder:text-muted-foreground max-h-60 min-h-[52px] w-full resize-none bg-transparent px-5 pt-4 text-base leading-6 outline-none"
        />

        <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <AddMenu side={menuSide} />
            <ModeMenu side={menuSide} />
          </div>

          <div className="flex items-center gap-1">
            <ModelPicker side={menuSide} />
            <AuiIf condition={(s) => s.thread.isRunning}>
              <ComposerPrimitive.Cancel
                className={primaryButton}
                aria-label={t("Stop response (Esc)")}
                title={t("Stop response (Esc)")}
              >
                <IconSquare className="size-3 fill-current" />
              </ComposerPrimitive.Cancel>
            </AuiIf>
            <AuiIf condition={(s) => !s.thread.isRunning}>
              {signedOut ? (
                <button
                  type="button"
                  onClick={() => ask(text)}
                  className={primaryButton}
                  aria-label={t("Submit")}
                >
                  <IconArrowUp className="size-4" />
                </button>
              ) : (
                <ComposerPrimitive.Send className={primaryButton} aria-label={t("Submit")}>
                  <IconArrowUp className="size-4" />
                </ComposerPrimitive.Send>
              )}
            </AuiIf>
          </div>
        </div>
      </ComposerPrimitive.Root>

      {choices.length > 0 && (
        <div
          role="listbox"
          className={cn(
            "bg-card ring-foreground/7 absolute z-30 flex flex-col gap-0.5 rounded-xl p-1 shadow-lg ring-1",
            command ? "start-3 w-72" : "inset-x-0",
            menuSide === "top"
              ? "bottom-full mb-2"
              : "max-md:bottom-full max-md:mb-2 md:top-full md:mt-2",
          )}
        >
          {command && (
            <p className="text-muted-foreground px-2.5 pt-1.5 pb-1 text-xs">
              {command.startsWith("/") ? t("Mode") : t("Search only")}
            </p>
          )}
          {choices.map((choice, index) => (
            <div
              key={choice.key}
              role="option"
              aria-selected={index === highlighted}
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => {
                setActive(index);
                setPicked(true);
              }}
              onClick={choice.choose}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                index === highlighted ? "bg-muted" : "",
              )}
            >
              <span className="text-muted-foreground">{choice.icon}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{choice.label}</span>
                {choice.hint && (
                  <span className="text-muted-foreground truncate text-xs">{choice.hint}</span>
                )}
              </span>
              {choice.fill && (
                <button
                  type="button"
                  aria-label={t("Use this text")}
                  onClick={(event) => {
                    event.stopPropagation();
                    choice.fill?.();
                  }}
                  className="text-super hover:bg-foreground/10 flex size-6 items-center justify-center rounded-md"
                >
                  <IconArrowUpLeft className="size-3.5 rtl:-scale-x-100" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AddMenu: FC<{ side: "top" | "bottom" }> = ({ side }) => {
  const upload = useRef<HTMLButtonElement>(null);
  const t = useT();

  return (
    <>
      <ComposerPrimitive.AddAttachment ref={upload} className="hidden" />
      <DropdownMenu>
        <DropdownMenuTrigger className={iconButton} aria-label={t("Add files or tools")}>
          <IconPlus className="size-4.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side={side} align="start" className="w-60">
          <DropdownMenuItem onSelect={() => upload.current?.click()}>
            <IconPaperclip className="size-4" />
            {t("Upload files or images")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

const ModeMenu: FC<{ side: "top" | "bottom" }> = ({ side }) => {
  const mode = useChatOptions((s) => s.mode);
  const setMode = useChatOptions((s) => s.setMode);
  const t = useT();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="border-border bg-foreground/5 hover:bg-foreground/10 flex h-8 items-center gap-1.5 rounded-full border pe-2.5 ps-2 text-sm transition-colors">
        {MODE_ICONS[mode]}
        {t(MODE_DETAILS[mode].name)}
        <IconChevronDown className="text-muted-foreground size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="start" className="w-72">
        <DropdownMenuLabel>{t("Mode")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => setMode(modeSchema.parse(value))}
        >
          {MODES.map((name) => (
            <DropdownMenuRadioItem key={name} value={name} className="py-2">
              {MODE_ICONS[name]}
              <span className="flex flex-col">
                <span>{t(MODE_DETAILS[name].name)}</span>
                <span className="text-muted-foreground text-xs">
                  {t(MODE_DETAILS[name].description)}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const AttachmentChip: FC = () => {
  const src = useAttachmentSrc();
  const t = useT();

  return (
    <div className="border-border bg-muted flex max-w-65 items-center gap-3 rounded-xl border py-2 pe-3 ps-2">
      <div className="bg-background text-muted-foreground relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
        {src ? (
          <Image
            src={src}
            alt={t("Attachment")}
            fill
            unoptimized
            sizes="40px"
            className="object-cover"
          />
        ) : (
          <IconFile className="size-4" />
        )}
      </div>
      <p className="min-w-0 truncate text-sm leading-5">
        <AttachmentPrimitive.Name />
      </p>
    </div>
  );
};

const AttachmentPreview: FC = () => {
  return (
    <AttachmentPrimitive.Root className="group/attachment relative">
      <AttachmentChip />
      <AttachmentPrimitive.Remove className="bg-card border-border text-muted-foreground hover:text-foreground absolute -top-1.5 -end-1.5 flex size-5 items-center justify-center rounded-full border opacity-0 transition-opacity group-hover/attachment:opacity-100 pointer-coarse:opacity-100">
        <IconX className="size-3" />
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
};
