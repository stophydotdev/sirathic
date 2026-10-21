"use client";

import { useAccount } from "@/components/account";
import { useChatOptions } from "@/components/chat-options";
import { useT } from "@/components/i18n";
import { Mark } from "@/components/logo";
import { OpenAIIcon } from "@/components/openai-icon";
import { THEME_NAMES, THEMES, usePreferences } from "@/components/preferences";
import { useSessions } from "@/components/sessions";
import { useSettings } from "@/components/settings";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/messages/en";
import {
  ArrowUpRight,
  ChevronRight,
  ChevronUp,
  CopyIcon,
  LogOut,
  MoonIcon,
  SettingsIcon,
  UserCircle,
  VenetianMaskIcon,
  X,
} from "lucide-react";
import { Dialog } from "radix-ui";
import { type FC, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { create } from "zustand";

export const useSignIn = create<{
  open: boolean;
  draft: string;
  ask: (draft?: string) => void;
  setOpen: (open: boolean) => void;
}>()((set) => ({
  open: false,
  draft: "",
  ask: (draft = "") => set({ open: true, draft: draft.trim() }),
  setOpen: (open) => set({ open }),
}));

const deviceCode = z.object({
  userCode: z.string(),
  intervalMs: z.number(),
  verificationUrl: z.url(),
});

const devicePoll = z.object({
  status: z.enum(["pending", "expired", "signed-in"]),
});

const apiError = z.union([
  z.object({ error: z.string() }).transform((body) => body.error),
  z.object({ message: z.string() }).transform((body) => body.message),
]);

type Step =
  | { kind: "start" }
  | { kind: "asking" }
  | ({ kind: "code" } & z.infer<typeof deviceCode>)
  | { kind: "expired" }
  | { kind: "failed"; message: string };

const START: Step = { kind: "start" };

const TITLES = {
  start: "Assalamu alaikum. Sign in to start asking.",
  asking: "Assalamu alaikum. Sign in to start asking.",
  code: "Enter this code on ChatGPT",
  expired: "Code expired",
  failed: "Sign-in didn't work",
} satisfies Record<Step["kind"], MessageKey>;

async function readJson<S extends z.ZodType>(res: Response, schema: S) {
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new Error(
      apiError.safeParse(body).data ?? `The server answered ${res.status}`,
    );
  }
  return schema.parse(body);
}

const button =
  "flex h-10 w-full items-center justify-center gap-2 rounded-[10px] text-sm font-medium transition";
const primary = "bg-primary text-primary-foreground hover:opacity-90";

export const SignInDialog: FC = () => {
  const open = useSignIn((s) => s.open);
  const setOpen = useSignIn((s) => s.setOpen);
  const draft = useSignIn((s) => s.draft);
  const content = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>(START);
  const t = useT();

  const getCode = () => {
    setStep({ kind: "asking" });
    fetch("/api/auth/chatgpt/start", { method: "POST" })
      .then((res) => readJson(res, deviceCode))
      .then((code) => setStep({ kind: "code", ...code }))
      .catch((err: Error) => setStep({ kind: "failed", message: err.message }));
  };

  useEffect(() => {
    if (step.kind !== "code") return;
    let stopped = false;
    const finish = async (status: z.infer<typeof devicePoll>["status"]) => {
      if (stopped) return;
      if (status === "pending") {
        timer = setTimeout(poll, step.intervalMs);
      } else if (status === "expired") {
        setStep({ kind: "expired" });
      } else {
        await Promise.all([
          useAccount.getState().refresh(),
          useSessions.getState().refresh(),
        ]);
        setOpen(false);
        setStep(START);
      }
    };
    const poll = () =>
      fetch("/api/auth/chatgpt/poll")
        .then((res) => readJson(res, devicePoll))
        .then(({ status }) => finish(status))
        .catch((err: Error) => {
          if (!stopped) setStep({ kind: "failed", message: err.message });
        });
    let timer = setTimeout(poll, step.intervalMs);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [step, setOpen]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setStep(START);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="bg-background/70 fixed inset-0 z-[60] backdrop-blur-[4px]" />
        <Dialog.Content
          ref={content}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            content.current?.focus();
          }}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="bg-background border-border fixed top-1/2 left-1/2 z-[60] flex w-[360px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-5 rounded-[14px] border px-[26px] pt-[34px] pb-[22px] text-center outline-none"
        >
          <Dialog.Close
            aria-label={t("Close")}
            className="text-muted-foreground hover:text-foreground absolute top-3 end-3 flex size-7 items-center justify-center rounded-full"
          >
            <X className="size-4" />
          </Dialog.Close>
          <Mark size={26} color="currentColor" />
          <Dialog.Title className="text-[17px] font-medium tracking-[-0.01em] text-balance">
            {t(TITLES[step.kind])}
          </Dialog.Title>
          {step.kind === "code" ? (
            <>
              <CodeCells code={step.userCode} />
              <CopyCode code={step.userCode} />
              <a
                href={step.verificationUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(button, primary)}
              >
                {t("Open ChatGPT")}
                <ArrowUpRight className="size-4" />
              </a>
              <span className="text-muted-foreground inline-flex items-center gap-2 text-xs">
                <span className="bg-super ring-super/20 size-1.5 rounded-full ring-3" />
                {t("Waiting for approval")}
              </span>
              <p className="text-muted-foreground/70 border-border w-full border-t pt-3.5 text-[11.5px] leading-normal">
                {t(
                  "First time? Turn on device code sign-in in ChatGPT → Settings → Security. ChatGPT will say Codex, that's expected.",
                )}
              </p>
            </>
          ) : (
            <>
              {step.kind === "failed" && (
                <p className="text-muted-foreground text-sm">{step.message}</p>
              )}
              {step.kind === "start" || step.kind === "asking" ? (
                <div className="flex w-full flex-col items-center gap-2">
                  <button
                    type="button"
                    disabled={step.kind === "asking"}
                    onClick={getCode}
                    className={cn(button, primary, "disabled:opacity-60")}
                  >
                    <OpenAIIcon className="size-4" />
                    {t("Continue with ChatGPT")}
                  </button>
                  <p className="text-muted-foreground text-xs">
                    {t("Use your ChatGPT plan for GPT models")}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={
                    step.kind === "expired" ? getCode : () => setStep(START)
                  }
                  className={cn(button, primary)}
                >
                  {step.kind === "expired"
                    ? t("Get a new code")
                    : t("Try again")}
                </button>
              )}
              {draft && (
                <p className="text-muted-foreground/70 border-border w-full border-t pt-3.5 text-[11.5px] leading-normal">
                  {t("Your question stays in the box while you sign in.")}
                </p>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const CodeCells: FC<{ code: string }> = ({ code }) => (
  <div className="flex items-center gap-[3px] sm:gap-1" aria-label={code}>
    {[...code].map((char, index) =>
      char === "-" ? (
        <span
          key={`${index}-dash`}
          aria-hidden
          className="bg-muted-foreground/50 mx-0.5 h-px w-2"
        />
      ) : (
        <span
          key={`${index}-${char}`}
          aria-hidden
          className="bg-muted border-border grid h-9 w-6 place-items-center rounded-md border font-mono text-lg font-medium sm:w-[26px]"
        >
          {char}
        </span>
      ),
    )}
  </div>
);

const CopyCode: FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const t = useT();

  const copy = async () => {
    const done = await navigator.clipboard.writeText(code).then(
      () => true,
      () => false,
    );
    if (!done) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs"
    >
      <CopyIcon className="size-3.5" />
      {copied ? t("Copied") : t("Copy code")}
    </button>
  );
};

const shortcut = "text-muted-foreground ms-auto ps-3 text-xs";

const row =
  "hover:bg-foreground/10 bg-muted flex h-11 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-start text-[15px]";

export const AccountRow: FC<{ collapsed?: boolean; onDone?: () => void }> = ({
  collapsed = false,
  onDone,
}) => {
  const status = useAccount((s) => s.status);
  const signOut = useAccount((s) => s.signOut);
  const ask = useSignIn((s) => s.ask);
  const openSettings = useSettings((s) => s.setOpen);
  const incognito = useChatOptions((s) => s.incognito);
  const setIncognito = useChatOptions((s) => s.setIncognito);
  const theme = usePreferences((s) => s.theme);
  const changePreferences = usePreferences((s) => s.change);
  const t = useT();

  if (status === undefined) {
    return (
      <div
        className={cn(
          "bg-muted flex h-11 items-center gap-2.5 rounded-[8px] px-2.5",
          collapsed && "justify-center px-0",
        )}
      >
        <Skeleton className="size-[26px] shrink-0 rounded-full" />
        {!collapsed && <Skeleton className="h-2.5 w-20" />}
      </div>
    );
  }
  if (!status.signedIn) {
    return (
      <button
        type="button"
        onClick={() => {
          onDone?.();
          ask();
        }}
        className={cn(row, collapsed && "justify-center px-0")}
      >
        <UserCircle className="size-6 shrink-0 stroke-[1.5]" />
        {!collapsed && <span className="flex-1">{t("Sign In")}</span>}
        {!collapsed && (
          <ChevronRight className="text-super size-3.5 rtl:rotate-180" />
        )}
      </button>
    );
  }

  const viaGoogle = status.via === "google";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("Account menu")}
        className={cn(row, collapsed && "justify-center px-0")}
      >
        {status.image ? (
          <img
            src={status.image}
            alt=""
            referrerPolicy="no-referrer"
            className="size-[26px] shrink-0 rounded-full"
          />
        ) : (
          <span className="ring-border flex size-[26px] shrink-0 items-center justify-center rounded-full bg-black text-white ring-1">
            <Mark size={16} color="currentColor" />
          </span>
        )}
        {!collapsed && (
          <span className="flex-1 truncate">
            {status.label ??
              t(viaGoogle ? "Google account" : "ChatGPT account")}
          </span>
        )}
        {!collapsed && <ChevronUp className="text-muted-foreground size-3.5" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-[12px] p-1.5"
      >
        <DropdownMenuLabel className="flex flex-col gap-0.5 px-2.5 py-2 font-normal">
          <span className="text-sm font-[470]">
            {status.label ??
              t(viaGoogle ? "Google account" : "ChatGPT account")}
          </span>
          <span className="text-muted-foreground text-xs">
            {t(viaGoogle ? "Signed in with Google" : "Signed in with ChatGPT")}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={incognito}
          onCheckedChange={setIncognito}
          onSelect={(event) => event.preventDefault()}
        >
          <VenetianMaskIcon className="size-4" />
          {t("Incognito")}
          <span className={shortcut}>Ctrl ;</span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem
          onSelect={() => {
            onDone?.();
            openSettings(true);
          }}
        >
          <SettingsIcon className="size-4" />
          {t("All settings")}
          <span className={shortcut}>Ctrl Shift ,</span>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <MoonIcon className="size-4" />
            <span className="flex flex-col">
              {t("Appearance")}
              <span className="text-muted-foreground text-xs">
                {t(THEME_NAMES[theme])}
              </span>
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-40">
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(next) => {
                const picked = THEMES.find((value) => value === next);
                if (picked) changePreferences({ theme: picked });
              }}
            >
              {THEMES.map((value) => (
                <DropdownMenuRadioItem
                  key={value}
                  value={value}
                  onSelect={(event) => event.preventDefault()}
                >
                  {t(THEME_NAMES[value])}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut className="size-4" />
          {t("Sign out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
