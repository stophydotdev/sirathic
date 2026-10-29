"use client";

import { useChatState } from "@/components/chat";
import { useT } from "@/components/i18n";
import { cn } from "@/lib/utils";
import type RFB from "@novnc/novnc";
import type { screenMode } from "@sirathic/browser/protocol";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, ComputerIcon, KeyboardIcon } from "@hugeicons/core-free-icons";
import { type FC, type RefObject, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { create } from "zustand";

export const useBrowser = create<{ showing: boolean; show: () => void; hide: () => void }>()(
  (set) => ({
    showing: false,
    show: () => set({ showing: true }),
    hide: () => set({ showing: false }),
  }),
);

type Mode = z.infer<typeof screenMode>;

const RETRY_MS = 4_000;
const SCREEN_WIDTH = "min(72rem, calc((100dvh - 8rem) * 1.6))";
const KEYS = new Map([
  ["Backspace", 0xff08],
  ["Tab", 0xff09],
  ["Enter", 0xff0d],
]);

const ticketBody = z.object({ ticket: z.string() });

const screenUrl = (botId: string, mode: Mode, ticket: string) => {
  const url = new URL(`/api/bots/${botId}/browser/screen`, process.env.NEXT_PUBLIC_SERVER);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("mode", mode);
  url.searchParams.set("ticket", ticket);
  return url.href;
};

const keysymOf = (character: string) => {
  const code = character.codePointAt(0) ?? 0;
  return code < 0x100 ? code : 0x01000000 + code;
};

const useScreen = (botId: string, mode: Mode, target: RefObject<HTMLDivElement | null>) => {
  const [live, setLive] = useState<boolean>();
  const remote = useRef<RFB>(undefined);
  useEffect(() => {
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const again = () => {
      setLive(false);
      if (!stopped) retry = setTimeout(() => void connect(), RETRY_MS);
    };
    const connect = async () => {
      const response = await fetch(`/api/bots/${botId}/browser/ticket`, { method: "POST" }).catch(
        () => undefined,
      );
      const ticket = response?.ok
        ? ticketBody.safeParse(await response.json()).data?.ticket
        : undefined;
      if (stopped) return;
      if (!ticket || !target.current) {
        again();
        return;
      }
      const { default: Remote } = await import("@novnc/novnc");
      if (stopped || !target.current) return;
      const rfb = new Remote(target.current, screenUrl(botId, mode, ticket));
      rfb.viewOnly = mode === "watch";
      rfb.focusOnClick = mode === "control";
      rfb.scaleViewport = true;
      rfb.background = "transparent";
      rfb.qualityLevel = 6;
      rfb.addEventListener("connect", () => setLive(true));
      rfb.addEventListener("disconnect", () => {
        remote.current = undefined;
        again();
      });
      remote.current = rfb;
    };
    void connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      remote.current?.disconnect();
      remote.current = undefined;
    };
  }, [botId, mode, target]);
  return { live, remote };
};

export const BrowserPreview: FC<{ botId: string; name: string }> = ({ botId, name }) => {
  const target = useRef<HTMLDivElement>(null);
  const { live } = useScreen(botId, "watch", target);
  const show = useBrowser((s) => s.show);
  const t = useT();
  return (
    <figure className="flex flex-col items-center gap-2.5">
      <div className="bg-foreground/4 border-foreground/10 relative aspect-16/10 w-full overflow-hidden rounded-xl border">
        <div ref={target} className={cn("size-full", !live && "invisible")} />
        {live ? (
          <button
            type="button"
            aria-label={t("Open the browser")}
            onClick={show}
            className="absolute inset-0 hover:bg-white/5"
          />
        ) : (
          <span className="text-muted-foreground absolute inset-0 flex items-center justify-center">
            <HugeiconsIcon icon={ComputerIcon} className="size-5" />
          </span>
        )}
      </div>
      <figcaption className="text-muted-foreground text-xs">
        {t("{name}'s screen", { name })}
      </figcaption>
    </figure>
  );
};

const FullView: FC<{ botId: string; name: string }> = ({ botId, name }) => {
  const hide = useBrowser((s) => s.hide);
  const chat = useChatState()?.chat;
  const target = useRef<HTMLDivElement>(null);
  const typing = useRef<HTMLInputElement>(null);
  const { live, remote } = useScreen(botId, "control", target);
  const t = useT();
  const press = (keysym: number, code: string | null) => remote.current?.sendKey(keysym, code);
  return (
    <div
      role="dialog"
      aria-modal
      aria-label={t("{name}'s screen", { name })}
      className="fixed inset-0 z-70 flex flex-col items-center justify-center gap-4 bg-black/60 p-3 backdrop-blur-sm md:p-8"
    >
      <div
        style={{ width: SCREEN_WIDTH }}
        className="relative aspect-16/10 max-w-full overflow-hidden rounded-2xl bg-black shadow-2xl"
      >
        <div ref={target} className="size-full" />
        {live === false && (
          <p className="text-muted-foreground absolute inset-0 flex items-center justify-center px-6 text-center text-sm">
            {t("Your bot's browser is closed.")}
          </p>
        )}
        <input
          ref={typing}
          aria-label={t("Type here")}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onKeyDown={(event) => {
            const keysym = KEYS.get(event.key);
            if (keysym === undefined) return;
            event.preventDefault();
            press(keysym, event.key);
          }}
          onInput={(event) => {
            const text = event.currentTarget.value;
            event.currentTarget.value = "";
            for (const character of text) press(keysymOf(character), null);
          }}
          className="sr-only"
        />
      </div>
      <div className="bg-card/95 border-foreground/14 flex h-12 max-w-full shrink-0 items-center gap-2.5 rounded-xl border ps-4 pe-1.5 text-sm backdrop-blur-sm">
        <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
        <span className="text-muted-foreground min-w-0 truncate">
          {t("{name} waits while you use it", { name })}
        </span>
        <button
          type="button"
          aria-label={t("Keyboard")}
          onClick={() => typing.current?.focus()}
          className="text-muted-foreground hover:bg-muted hover:text-foreground hidden size-9 shrink-0 items-center justify-center rounded-xl pointer-coarse:flex"
        >
          <HugeiconsIcon icon={KeyboardIcon} className="size-4.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            void chat?.sendMessage({ text: t("I'm done"), metadata: { createdAt: Date.now() } });
            hide();
          }}
          className="bg-foreground text-background h-9 shrink-0 rounded-full px-4 font-medium"
        >
          {t("I'm done")}
        </button>
        <span className="bg-foreground/14 h-5 w-px shrink-0" />
        <button
          type="button"
          aria-label={t("Close")}
          onClick={hide}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-xl"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-4.5" />
        </button>
      </div>
    </div>
  );
};

export const BrowserScreen: FC<{ botId: string; name: string }> = ({ botId, name }) => {
  const showing = useBrowser((s) => s.showing);
  return showing ? <FullView botId={botId} name={name} /> : null;
};
