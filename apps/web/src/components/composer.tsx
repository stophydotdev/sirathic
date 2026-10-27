"use client";

import { MODE_DETAILS, useChatOptions } from "@/components/chatOptions";
import { takeDraft } from "@/components/draft";
import { useT } from "@/components/i18n";
import { useAccount } from "@/components/account";
import {
  type Choice,
  LinkPlugin,
  MentionChip,
  MentionSpace,
  mentionFormatter,
  MentionPopover,
} from "@/components/mentions";
import { RecentFiles } from "@/components/libraryRecent";
import { popoverHeading, popoverIcon, popoverPanel, popoverRow } from "@/components/popover";
import { ModelPicker } from "@/components/modelPicker";
import { ProjectIcon } from "@/components/projectIcon";
import { useSignIn } from "@/components/signIn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { useAttachmentSrc } from "@/lib/hooks/useAttachmentSrc";
import { type Mode, MODES, mode as modeSchema } from "@sirathic/server/messages";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/messages/en";
import {
  AttachmentPrimitive,
  AuiIf,
  ComposerPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import { LexicalComposerInput } from "@assistant-ui/react-lexical";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowUp02Icon,
  Attachment01Icon,
  Cancel01Icon,
  File01Icon,
  Search01Icon,
  Telescope01Icon,
} from "@hugeicons/core-free-icons";
import Image from "next/image";
import Link from "next/link";
import { type FC, type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";

const ROTATING = [
  "Ask anything…",
  "Type / for modes, @ for plugins and skills",
] as const satisfies readonly MessageKey[];
const ROTATE_MS = 4_000;

const finePointer = globalThis.matchMedia?.("(pointer: fine)").matches ?? false;

const iconButton =
  "text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-40";

const primaryButton =
  "bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-foreground/15 disabled:text-background flex size-8 shrink-0 items-center justify-center rounded-full transition-colors";

export const MODE_ICONS = {
  quick: <HugeiconsIcon icon={Search01Icon} className="size-4" />,
  research: <HugeiconsIcon icon={Telescope01Icon} className="size-4" />,
} satisfies Record<Mode, ReactNode>;

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

export const Composer: FC<{
  placeholder: string;
  menuSide: "top" | "bottom";
  rotate?: boolean;
  bot?: boolean;
  compact?: boolean;
  project?: {
    id: string;
    name: string;
    icon: string | null;
    leaveLabel: string;
    onLeave: (text: string) => void;
  };
}> = ({ placeholder, menuSide, rotate = false, bot = false, compact = false, project }) => {
  const aui = useAui();
  const text = useAuiState((s) => s.composer.text);
  const setMode = useChatOptions((s) => s.setMode);
  useEffect(() => {
    const draft = takeDraft();
    if (draft) aui.thread().composer().setText(draft);
  }, [aui]);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState(false);
  const [seen, setSeen] = useState(text);
  if (seen !== text) {
    setSeen(text);
    setActive(0);
    setPicked(false);
  }
  const signedOut = useAccount((s) => s.status?.signedIn === false);
  const signedIn = useAccount((s) => s.status?.signedIn === true);
  const ask = useSignIn((s) => s.ask);
  const shown = useRotatingPlaceholder(placeholder, rotate && text === "");
  const t = useT();
  const hasAttachments = useAuiState((s) => s.composer.attachments.length > 0);
  const editor = useRef<HTMLDivElement>(null);
  const [wrapped, setWrapped] = useState(false);
  if (wrapped && text === "") setWrapped(false);
  useEffect(() => {
    const box = editor.current;
    if (!box) return;
    const observer = new ResizeObserver(() => {
      if (box.offsetHeight > Number.parseFloat(getComputedStyle(box).lineHeight) * 1.5)
        setWrapped(true);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);
  const row = compact && !wrapped && !hasAttachments && project === undefined;

  const command = /^\/[^\s]*$/u.test(text) ? text : undefined;
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
    : [];
  const selecting = command !== undefined || picked;
  const highlighted = selecting ? Math.min(active, Math.max(choices.length - 1, 0)) : -1;

  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) return;
    const take = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    if (event.key === "ArrowUp" && text === "" && !selecting) {
      const index = aui
        .thread()
        .getState()
        .messages.findLastIndex((message) => message.role === "user");
      if (index < 0) return;
      take();
      aui.thread().message({ index }).composer().beginEdit();
      return;
    }
    if (signedOut && event.key === "Enter" && !event.shiftKey && !selecting) {
      take();
      ask(text);
      return;
    }
    if (choices.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      take();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const from = selecting ? highlighted : step > 0 ? -1 : 0;
      setActive((from + step + choices.length) % choices.length);
      setPicked(true);
    } else if (event.key === "Enter" && !event.shiftKey && selecting) {
      take();
      choices[highlighted]?.choose();
    }
  };

  const below =
    menuSide === "top" ? "bottom-full mb-2" : "max-md:bottom-full max-md:mb-2 md:top-full md:mt-2";

  return (
    <ComposerPrimitive.TriggerPopoverRoot>
      <div className="relative w-full">
        <ComposerPrimitive.Root
          className={cn(
            "bg-card border-foreground/10 flex w-full flex-wrap items-center border",
            compact ? "min-h-12 gap-x-1 rounded-4xl p-1.5 md:min-h-13 md:p-2" : "rounded-[20px]",
          )}
        >
          <AuiIf condition={(s) => s.composer.attachments.length > 0}>
            <div
              className={cn(
                "order-first flex basis-full flex-wrap gap-2",
                compact ? "px-2 pt-2 pb-1" : "px-4 pt-4",
              )}
            >
              <ComposerPrimitive.Attachments>
                {() => <AttachmentPreview />}
              </ComposerPrimitive.Attachments>
            </div>
          </AuiIf>

          <div
            className={cn(
              "min-w-0",
              row ? "flex-1 px-1.5" : "-order-1 basis-full",
              !row && (compact ? "px-2.5 pt-1.5 pb-1" : "px-5 pt-3.5"),
            )}
          >
            <LexicalComposerInput
              ref={editor}
              data-composer
              autoFocus={finePointer}
              placeholder={shown}
              formatter={mentionFormatter}
              directiveChip={MentionChip}
              onKeyDownCapture={onKeyDownCapture}
              className={cn("relative max-h-60 w-full text-base leading-6", !compact && "min-h-7")}
            >
              <LinkPlugin />
              <MentionSpace />
            </LexicalComposerInput>
          </div>

          <div
            className={cn(
              "flex min-w-0 items-center gap-1.5",
              row && "-order-1",
              !compact && "ps-3 pt-2.5 pb-3",
            )}
          >
            <AddMenu side={menuSide} modes={!bot} />
            {project && (
              <span className="border-foreground/15 flex h-8 min-w-0 items-center gap-1.5 rounded-full border ps-2.5 pe-1 text-sm font-medium">
                <ProjectIcon
                  icon={project.icon}
                  className="text-muted-foreground size-4 shrink-0"
                />
                <Link
                  href={`/project/${project.id}`}
                  title={t("Open project")}
                  className="max-w-48 min-w-6 truncate hover:underline"
                >
                  {project.name}
                </Link>
                <button
                  type="button"
                  aria-label={project.leaveLabel}
                  title={project.leaveLabel}
                  onClick={() => project.onLeave(text)}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-6 items-center justify-center rounded-full"
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                </button>
              </span>
            )}
          </div>

          <div className={cn("ms-auto flex items-center gap-1", !compact && "pe-3 pt-2.5 pb-3")}>
            <ModelPicker side={menuSide} />
            <AuiIf condition={(s) => s.thread.isRunning}>
              <ComposerPrimitive.Cancel
                className={primaryButton}
                aria-label={t("Stop response (Esc)")}
                title={t("Stop response (Esc)")}
              >
                <span className="size-2.5 rounded-xs bg-current" />
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
                  <HugeiconsIcon icon={ArrowUp02Icon} className="size-4" />
                </button>
              ) : (
                <ComposerPrimitive.Send className={primaryButton} aria-label={t("Submit")}>
                  <HugeiconsIcon icon={ArrowUp02Icon} className="size-4" />
                </ComposerPrimitive.Send>
              )}
            </AuiIf>
          </div>
        </ComposerPrimitive.Root>

        {signedIn && <MentionPopover className={cn("absolute start-3 z-30", below)} />}

        {choices.length > 0 && (
          <div
            role="listbox"
            className={cn(
              popoverPanel,
              "absolute z-30",
              command ? "start-3 w-72" : "inset-x-0",
              below,
            )}
          >
            {command && (
              <p className={popoverHeading}>
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
                className={cn(popoverRow, index === highlighted && "bg-foreground/8")}
              >
                <span className={popoverIcon}>{choice.icon}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{choice.label}</span>
                  {choice.hint && (
                    <span className="text-muted-foreground truncate text-xs">{choice.hint}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ComposerPrimitive.TriggerPopoverRoot>
  );
};

export const menuBox = "border-foreground/6 w-52 rounded-2xl border p-1.5";

export const menuItem = "h-8 gap-2 rounded-lg px-2";

const AddMenu: FC<{ side: "top" | "bottom"; modes: boolean }> = ({ side, modes }) => {
  const upload = useRef<HTMLButtonElement>(null);
  const mode = useChatOptions((s) => s.mode);
  const setMode = useChatOptions((s) => s.setMode);
  const t = useT();

  return (
    <>
      <ComposerPrimitive.AddAttachment ref={upload} className="hidden" />
      <DropdownMenu>
        <DropdownMenuTrigger className={iconButton} aria-label={t("Add files or tools")}>
          <HugeiconsIcon icon={Add01Icon} className="size-4.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side={side} align="start" className={menuBox}>
          {modes && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={menuItem}>
                {MODE_ICONS[mode]}
                <span className="flex-1">{t("Mode")}</span>
                <span className="text-muted-foreground text-xs">{t(MODE_DETAILS[mode].name)}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className={cn(menuBox, "w-72")}>
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
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuItem onSelect={() => upload.current?.click()} className={menuItem}>
            <HugeiconsIcon icon={Attachment01Icon} className="size-4" />
            {t("Upload a file")}
          </DropdownMenuItem>
          <RecentFiles />
        </DropdownMenuContent>
      </DropdownMenu>
    </>
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
          <HugeiconsIcon icon={File01Icon} className="size-4" />
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
      <AttachmentPrimitive.Remove className="bg-card border-border text-muted-foreground hover:text-foreground absolute -top-1.5 -end-1.5 flex size-5 items-center justify-center rounded-full border opacity-0 group-hover/attachment:opacity-100 pointer-coarse:opacity-100">
        <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
};
