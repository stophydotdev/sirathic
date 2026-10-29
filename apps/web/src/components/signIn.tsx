"use client";

import { ACCOUNT_LABELS, useAccount } from "@/components/account";
import { useChatOptions } from "@/components/chatOptions";
import { saveDraft } from "@/components/draft";
import { GitHubIcon } from "@/components/githubIcon";
import { GoogleIcon } from "@/components/googleIcon";
import { useT } from "@/components/i18n";
import { CONTACT } from "@/components/legalPage";
import { Mark } from "@/components/logo";
import { THEME_NAMES, usePreferences } from "@/components/preferences";
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
} from "@/components/ui/dropdownMenu";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/messages/en";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Cancel01Icon,
  ComputerIcon,
  Download04Icon,
  File02Icon,
  HelpCircleIcon,
  IncognitoIcon,
  Logout03Icon,
  Message01Icon,
  Moon02Icon,
  SecurityLockIcon,
  Settings02Icon,
  Sun03Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { type FC, type ReactNode, useRef, useState } from "react";
import { THEMES } from "@sirathic/app/preferences";
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

const apiError = z.union([
  z.object({ error: z.string() }).transform((body) => body.error),
  z.object({ message: z.string() }).transform((body) => body.message),
]);

const socialSignIn = z.object({ url: z.url() });

type Step = { kind: "start" } | { kind: "failed"; message: string };

const START: Step = { kind: "start" };

const TITLES = {
  start: "Sign in to Sirathic",
  failed: "Sign-in didn't work",
} satisfies Record<Step["kind"], MessageKey>;

async function readJson<S extends z.ZodType>(res: Response, schema: S) {
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new Error(apiError.safeParse(body).data ?? `The server answered ${res.status}`);
  }
  return schema.parse(body);
}

const button =
  "flex h-10 w-full items-center justify-center gap-2 rounded-[10px] text-sm font-medium transition";
const primary = "bg-primary text-primary-foreground hover:opacity-90";
const secondary = "bg-muted hover:bg-foreground/10";

const continueWith = async (provider: "google" | "github", draft: string) => {
  const back = `${location.pathname}${location.search}`;
  const { url } = await fetch("/api/auth/sign-in/social", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider,
      callbackURL: back,
      errorCallbackURL: back,
    }),
  }).then((res) => readJson(res, socialSignIn));
  if (draft) saveDraft(draft);
  location.assign(url);
};

export const SignInDialog: FC = () => {
  const open = useSignIn((s) => s.open);
  const setOpen = useSignIn((s) => s.setOpen);
  const draft = useSignIn((s) => s.draft);
  const content = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>(START);
  const t = useT();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setStep(START);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dim fixed inset-0 z-[60] bg-black/60" />
        <Dialog.Content
          ref={content}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            content.current?.focus();
          }}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="pop bg-background border-border fixed top-1/2 left-1/2 z-[60] flex w-[360px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-5 rounded-[14px] border px-[26px] pt-[34px] pb-[22px] text-center outline-none"
        >
          <Dialog.Close
            aria-label={t("Close")}
            className="text-muted-foreground hover:text-foreground absolute top-3 end-3 flex size-7 items-center justify-center rounded-full"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </Dialog.Close>
          <Mark size={26} color="currentColor" />
          <Dialog.Title className="text-[17px] font-medium tracking-[-0.01em] text-balance">
            {t(TITLES[step.kind])}
          </Dialog.Title>
          <>
            {step.kind === "failed" && (
              <p className="text-muted-foreground text-sm">{step.message}</p>
            )}
            {step.kind === "start" ? (
              <div className="flex w-full flex-col items-center gap-2">
                <p className="text-muted-foreground -mt-3 mb-1 text-sm">
                  {t("Islamic answering engine.")} {t("Free.")}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    continueWith("google", draft).catch((err: Error) =>
                      setStep({ kind: "failed", message: err.message }),
                    )
                  }
                  className={cn(button, primary)}
                >
                  <GoogleIcon className="size-4" />
                  {t("Continue with Google")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    continueWith("github", draft).catch((err: Error) =>
                      setStep({ kind: "failed", message: err.message }),
                    )
                  }
                  className={cn(button, secondary)}
                >
                  <GitHubIcon className="size-4" />
                  {t("Continue with GitHub")}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setStep(START)} className={cn(button, primary)}>
                {t("Try again")}
              </button>
            )}
          </>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const shortcut = "text-muted-foreground ms-auto ps-3 text-xs";

const THEME_ICONS = {
  dark: <HugeiconsIcon icon={Moon02Icon} className="size-4" />,
  light: <HugeiconsIcon icon={Sun03Icon} className="size-4" />,
  system: <HugeiconsIcon icon={ComputerIcon} className="size-4" />,
} satisfies Record<(typeof THEMES)[number], ReactNode>;

const row =
  "hover:bg-muted flex h-10 w-full items-center gap-2.5 rounded-[12px] px-2.5 text-start text-sm font-medium";

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

  if (status === undefined) return <div className="h-10" />;
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
        <HugeiconsIcon icon={UserCircleIcon} className="size-6 shrink-0 stroke-[1.5]" />
        {!collapsed && <span className="flex-1">{t("Sign In")}</span>}
        {!collapsed && (
          <HugeiconsIcon icon={ArrowRight01Icon} className="text-super size-3.5 rtl:rotate-180" />
        )}
      </button>
    );
  }

  const labels = ACCOUNT_LABELS[status.via];

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
          <span className="min-w-0 flex-1 truncate">{status.label ?? t(labels.account)}</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-[12px] p-1.5"
      >
        <DropdownMenuLabel className="flex flex-col gap-0.5 px-2.5 py-2 font-normal">
          <span className="text-sm font-[470]">{status.label ?? t(labels.account)}</span>
          <span className="text-muted-foreground text-xs">{t(labels.signedIn)}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={incognito}
          onCheckedChange={setIncognito}
          onSelect={(event) => event.preventDefault()}
        >
          <HugeiconsIcon icon={IncognitoIcon} className="size-4" />
          {t("Incognito")}
          <span className={shortcut}>Ctrl ;</span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem
          onSelect={() => {
            onDone?.();
            openSettings(true);
          }}
        >
          <HugeiconsIcon icon={Settings02Icon} className="size-4" />
          {t("All settings")}
          <span className={shortcut}>Ctrl Shift ,</span>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/download" onClick={onDone}>
            <HugeiconsIcon icon={Download04Icon} className="size-4" />
            {t("Download")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <HugeiconsIcon icon={Moon02Icon} className="size-4" />
            <span className="flex flex-col">
              {t("Appearance")}
              <span className="text-muted-foreground text-xs">{t(THEME_NAMES[theme])}</span>
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
                  {THEME_ICONS[value]}
                  {t(THEME_NAMES[value])}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <HugeiconsIcon icon={HelpCircleIcon} className="size-4" />
            {t("Help")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-40">
            <DropdownMenuItem asChild>
              <a href={`mailto:${CONTACT}`}>
                <HugeiconsIcon icon={Message01Icon} className="size-4" />
                {t("Contact")}
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/privacy" onClick={onDone}>
                <HugeiconsIcon icon={SecurityLockIcon} className="size-4" />
                {t("Privacy")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/terms" onClick={onDone}>
                <HugeiconsIcon icon={File02Icon} className="size-4" />
                {t("Terms")}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <HugeiconsIcon icon={Logout03Icon} className="size-4" />
          {t("Sign out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
