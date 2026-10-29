"use client";

import { type Model, type Plan, useAccount } from "@/components/account";
import { useT } from "@/components/i18n";
import { MakerIcon } from "@/components/makerIcon";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdownMenu";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { Dialog } from "radix-ui";
import { type FC, useEffect, useRef, useState } from "react";
import { create } from "zustand";

export const PLANS = [
  { id: "chatgpt", name: "ChatGPT", maker: "openai" },
  { id: "minimax", name: "MiniMax", maker: "minimax" },
  { id: "xai", name: "Grok", maker: "xai" },
] as const satisfies readonly { id: Plan; name: string; maker: Model["maker"] }[];

type PlanInfo = (typeof PLANS)[number];

type Step =
  | { kind: "asking" }
  | ({ kind: "code" } & Awaited<ReturnType<typeof api.plans.start.mutate>>)
  | { kind: "expired" }
  | { kind: "failed"; message: string };

const ASKING: Step = { kind: "asking" };

const CHATGPT_SECURITY = "https://chatgpt.com/#settings/Security";

const POPUP = { width: 480, height: 720 };

const usePlanConnect = create<{
  plan: PlanInfo | undefined;
  step: Step;
  connect: (plan: PlanInfo) => void;
  setStep: (step: Step) => void;
  close: () => void;
}>()((set) => ({
  plan: undefined,
  step: ASKING,
  connect: (plan) => {
    set({ plan, step: ASKING });
    api.plans.start
      .mutate({ plan: plan.id })
      .then((started) => set({ step: { kind: "code", ...started } }))
      .catch((err: Error) => set({ step: { kind: "failed", message: err.message } }));
  },
  setStep: (step) => set({ step }),
  close: () => set({ plan: undefined }),
}));

const disconnect = async (plan: Plan) => {
  await api.plans.disconnect.mutate({ plan });
  await useAccount.getState().refresh();
};

const openBeside = (url: string) => {
  const left = Math.max(0, window.screenX + window.outerWidth - POPUP.width - 24);
  const popup = window.open(
    "",
    "plan-sign-in",
    `popup,width=${POPUP.width},height=${POPUP.height},left=${left},top=${window.screenY + 64}`,
  );
  if (!popup) return null;
  popup.opener = null;
  popup.location.href = url;
  return popup;
};

export const OwnPlans: FC = () => {
  const signedIn = useAccount((s) => s.status?.signedIn);
  const connected = useAccount((s) => s.plans);
  const connect = usePlanConnect((s) => s.connect);
  const t = useT();

  if (!signedIn) return null;

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-muted-foreground px-2 pt-1.5 pb-1 text-xs font-normal">
        {t("Use your own plan")}
      </DropdownMenuLabel>
      {PLANS.map((plan) => {
        const linked = connected.includes(plan.id);
        return (
          <DropdownMenuItem
            key={plan.id}
            onSelect={() => (linked ? void disconnect(plan.id) : connect(plan))}
            className="h-9 gap-2 rounded-lg p-2 text-sm font-[360]"
          >
            <MakerIcon maker={plan.maker} className="size-4" />
            <span className="min-w-0 flex-1 truncate">{plan.name}</span>
            <span className="bg-muted border-border rounded-full border px-2.5 py-0.5 text-xs">
              {linked ? t("Disconnect") : t("Connect")}
            </span>
          </DropdownMenuItem>
        );
      })}
    </>
  );
};

const button =
  "flex h-10 w-full items-center justify-center gap-2 rounded-[10px] text-sm font-medium transition";
const primary = "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60";

export const PlanConnectDialog: FC = () => {
  const plan = usePlanConnect((s) => s.plan);
  const step = usePlanConnect((s) => s.step);
  const connect = usePlanConnect((s) => s.connect);
  const setStep = usePlanConnect((s) => s.setStep);
  const close = usePlanConnect((s) => s.close);
  const content = useRef<HTMLDivElement>(null);
  const popup = useRef<Window | null>(null);
  const [help, setHelp] = useState(false);
  const t = useT();

  useEffect(() => {
    if (!plan || step.kind !== "code") return;
    let stopped = false;
    const poll = () =>
      api.plans.poll
        .mutate({ ticket: step.ticket })
        .then(async ({ status }) => {
          if (stopped) return;
          if (status === "pending") {
            timer = setTimeout(poll, step.intervalMs);
          } else if (status === "expired") {
            setStep({ kind: "expired" });
          } else {
            popup.current?.close();
            await useAccount.getState().refresh();
            close();
          }
        })
        .catch((err: Error) => {
          if (!stopped) setStep({ kind: "failed", message: err.message });
        });
    let timer = setTimeout(poll, step.intervalMs);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [plan, step, setStep, close]);

  const name = plan?.name ?? "";

  return (
    <Dialog.Root
      open={plan !== undefined}
      onOpenChange={(open) => {
        if (open) return;
        close();
        setHelp(false);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dim fixed inset-0 z-60 bg-black/60" />
        <Dialog.Content
          ref={content}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            content.current?.focus();
          }}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="pop bg-background border-border fixed top-1/2 left-1/2 z-60 flex w-90 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-5 rounded-[14px] border px-6.5 pt-8.5 pb-5.5 text-center outline-none"
        >
          <Dialog.Close
            aria-label={t("Close")}
            className="text-muted-foreground hover:text-foreground absolute top-3 end-3 flex size-7 items-center justify-center rounded-full"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </Dialog.Close>
          {plan && <MakerIcon maker={plan.maker} className="size-6.5" />}
          <Dialog.Title className="text-[17px] font-medium tracking-[-0.01em] text-balance">
            {step.kind === "expired"
              ? t("Code expired")
              : step.kind === "failed"
                ? t("Sign-in didn't work")
                : t("Enter this code on {name}", { name })}
          </Dialog.Title>
          {step.kind === "code" ? (
            <>
              <CodeCells code={step.userCode} />
              <a
                href={step.verificationUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  void navigator.clipboard.writeText(step.userCode).catch(() => undefined);
                  popup.current = openBeside(step.verificationUrl);
                  if (popup.current) event.preventDefault();
                }}
                className={cn(button, primary)}
              >
                {t("Copy code and open {name}", { name })}
                <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-4" />
              </a>
              <span className="text-muted-foreground inline-flex items-center gap-2 text-xs">
                <span className="bg-super ring-super/20 size-1.5 rounded-full ring-3" />
                {t("Waiting for you to approve it on {name}", { name })}
              </span>
              {plan?.id === "chatgpt" &&
                (help ? (
                  <p className="text-muted-foreground border-border w-full border-t pt-3.5 text-xs leading-normal">
                    {t(
                      "First time? Turn on device code sign-in in ChatGPT → Settings → Security. ChatGPT will say Codex, that's expected.",
                    )}
                  </p>
                ) : (
                  <a
                    href={CHATGPT_SECURITY}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setHelp(true)}
                    className="text-super inline-flex items-center gap-1 text-xs"
                  >
                    {t("Code not accepted?")}
                    <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3" />
                  </a>
                ))}
            </>
          ) : step.kind === "asking" ? (
            <button type="button" disabled className={cn(button, primary)}>
              {t("Copy code and open {name}", { name })}
            </button>
          ) : (
            <>
              {step.kind === "failed" && (
                <p className="text-muted-foreground text-sm">{step.message}</p>
              )}
              <button
                type="button"
                onClick={() => plan && connect(plan)}
                className={cn(button, primary)}
              >
                {step.kind === "expired" ? t("Get a new code") : t("Try again")}
              </button>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const CodeCells: FC<{ code: string }> = ({ code }) => (
  <div className="flex items-center gap-0.75 sm:gap-1" aria-label={code}>
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
          className="bg-muted border-border grid h-9 w-6 place-items-center rounded-md border text-lg font-medium sm:w-6.5"
        >
          {char}
        </span>
      ),
    )}
  </div>
);
