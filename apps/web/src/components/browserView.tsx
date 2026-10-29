"use client";

import { useT } from "@/components/i18n";
import { getFaviconUrl } from "@/lib/favicon";
import { type UserInput, VIEWPORT, viewEvent } from "@sirathic/browser/protocol";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { type FC, type KeyboardEvent, type MouseEvent, type WheelEvent, useEffect } from "react";
import { create } from "zustand";

type Screen =
  | { kind: "closed" }
  | { kind: "open"; url: string; title: string; jpeg: string | undefined };

export const useBrowser = create<{
  screen: Screen;
  showing: boolean;
  controlling: boolean;
  show: (controlling: boolean) => void;
  hide: () => void;
  control: (controlling: boolean) => void;
  seen: (screen: Screen) => void;
}>()((set) => ({
  screen: { kind: "closed" },
  showing: false,
  controlling: false,
  show: (controlling) => set({ showing: true, controlling }),
  hide: () => set({ showing: false, controlling: false }),
  control: (controlling) => set({ controlling }),
  seen: (screen) => set({ screen }),
}));

const hostOf = (url: string) => URL.parse(url)?.hostname ?? url;

const TEXT_MAX = 2_000;
const DELTA_MAX = 5_000;

type Outgoing = { botId: string; input: UserInput };

const outbox: Outgoing[] = [];
let sending = false;

const joined = (last: UserInput | undefined, input: UserInput): UserInput | undefined => {
  if (last?.kind === "text" && input.kind === "text") {
    const text = last.text + input.text;
    return text.length <= TEXT_MAX ? { kind: "text", text } : undefined;
  }
  if (last?.kind === "wheel" && input.kind === "wheel") {
    const deltaX = last.deltaX + input.deltaX;
    const deltaY = last.deltaY + input.deltaY;
    return Math.abs(deltaX) <= DELTA_MAX && Math.abs(deltaY) <= DELTA_MAX
      ? { ...input, deltaX, deltaY }
      : undefined;
  }
  return undefined;
};

const drain = async (): Promise<void> => {
  const next = outbox.shift();
  if (!next) {
    sending = false;
    return;
  }
  await fetch(`/api/bots/${next.botId}/browser/input`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(next.input),
  }).catch(() => undefined);
  return drain();
};

const send = (botId: string, input: UserInput) => {
  const last = outbox.at(-1);
  const merged = last?.botId === botId ? joined(last.input, input) : undefined;
  if (merged) outbox[outbox.length - 1] = { botId, input: merged };
  else outbox.push({ botId, input });
  if (sending) return;
  sending = true;
  void drain();
};

const BrowserStream: FC<{ botId: string; panelOpen: boolean }> = ({ botId, panelOpen }) => {
  const showing = useBrowser((s) => s.showing);
  const watching = panelOpen || showing;
  useEffect(() => {
    if (!watching) return;
    const { seen } = useBrowser.getState();
    const source = new EventSource(`/api/bots/${botId}/browser/view`);
    source.addEventListener("message", (message) => {
      const event = viewEvent.safeParse(JSON.parse(message.data)).data;
      const { screen } = useBrowser.getState();
      const jpeg = screen.kind === "open" ? screen.jpeg : undefined;
      if (event?.kind === "closed") seen({ kind: "closed" });
      if (event?.kind === "page") seen({ kind: "open", url: event.url, title: event.title, jpeg });
      if (event?.kind === "frame") {
        seen(
          screen.kind === "open"
            ? { ...screen, jpeg: event.jpeg }
            : { kind: "open", url: "", title: "", jpeg: event.jpeg },
        );
      }
    });
    return () => {
      source.close();
      seen({ kind: "closed" });
    };
  }, [botId, watching]);
  return null;
};

const Frame: FC<{ jpeg: string | undefined; title: string; className: string }> = ({
  jpeg,
  title,
  className,
}) =>
  jpeg ? (
    <img
      src={`data:image/jpeg;base64,${jpeg}`}
      alt={title}
      draggable={false}
      className={className}
    />
  ) : (
    <div className={`bg-foreground/6 ${className}`} />
  );

const SiteLine: FC<{ url: string; title: string }> = ({ url, title }) => (
  <span className="flex min-w-0 items-center gap-2 text-sm">
    {url && (
      <img
        src={getFaviconUrl(url) ?? undefined}
        alt=""
        onError={(event) => {
          event.currentTarget.hidden = true;
        }}
        className="size-4 shrink-0 rounded-sm"
      />
    )}
    <span className="truncate font-medium">{title || hostOf(url)}</span>
    <span className="text-muted-foreground shrink-0 truncate">{hostOf(url)}</span>
  </span>
);

export const BrowserPreview: FC = () => {
  const screen = useBrowser((s) => s.screen);
  const show = useBrowser((s) => s.show);
  const t = useT();
  if (screen.kind === "closed") return null;
  return (
    <button
      type="button"
      aria-label={t("Open the browser")}
      onClick={() => show(false)}
      className="hover:bg-foreground/6 -mx-2 flex flex-col gap-2 rounded-2xl p-2 text-start"
    >
      <Frame
        jpeg={screen.jpeg}
        title={screen.title}
        className="border-foreground/10 aspect-16/10 w-full rounded-xl border object-cover object-top"
      />
      <SiteLine url={screen.url} title={screen.title} />
    </button>
  );
};

const MODIFIERS = new Set(["Shift", "Control", "Alt", "Meta"]);

const keyOf = (event: KeyboardEvent<HTMLInputElement>) =>
  [
    event.ctrlKey && "Control",
    event.metaKey && "Meta",
    event.altKey && "Alt",
    event.shiftKey && event.key.length > 1 && "Shift",
    event.key,
  ]
    .filter(Boolean)
    .join("+");

const clamp = (value: number, max: number) => Math.round(Math.min(Math.max(value, 0), max));

const pointOf = (event: MouseEvent<HTMLElement> | WheelEvent<HTMLElement>) => {
  const box = event.currentTarget.getBoundingClientRect();
  const scale = Math.min(box.width / VIEWPORT.width, box.height / VIEWPORT.height);
  const left = box.left + (box.width - VIEWPORT.width * scale) / 2;
  const top = box.top + (box.height - VIEWPORT.height * scale) / 2;
  return {
    x: clamp((event.clientX - left) / scale, VIEWPORT.width),
    y: clamp((event.clientY - top) / scale, VIEWPORT.height),
  };
};

export const BrowserScreen: FC<{ botId: string; panelOpen: boolean }> = ({ botId, panelOpen }) => {
  const { screen, showing, controlling, hide, control } = useBrowser();
  const t = useT();
  return (
    <>
      <BrowserStream botId={botId} panelOpen={panelOpen} />
      {showing && (
        <div
          role="dialog"
          aria-modal
          aria-label={t("Open the browser")}
          onKeyDown={(event) => event.key === "Escape" && !controlling && hide()}
          className="bg-background fixed inset-0 z-70 flex flex-col"
        >
          <div className="flex h-14 shrink-0 items-center gap-2 ps-4 pe-2">
            <div className="min-w-0 flex-1">
              {screen.kind === "open" && <SiteLine url={screen.url} title={screen.title} />}
            </div>
            {screen.kind === "open" && (
              <button
                type="button"
                aria-pressed={controlling}
                onClick={() => control(!controlling)}
                className={`h-9 shrink-0 rounded-full px-4 text-sm font-medium ${controlling ? "bg-foreground text-background" : "bg-foreground/8 hover:bg-foreground/12"}`}
              >
                {controlling ? t("Stop control") : t("Take control")}
              </button>
            )}
            <button
              type="button"
              aria-label={t("Close")}
              onClick={hide}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-full"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-4.5" />
            </button>
          </div>
          {screen.kind === "closed" ? (
            <p className="text-muted-foreground m-auto px-6 text-center text-sm">
              {t("Your bot's browser is closed.")}
            </p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-2 md:p-4">
              <div
                onClick={(event) =>
                  controlling && void send(botId, { kind: "click", ...pointOf(event) })
                }
                onWheel={(event) =>
                  controlling &&
                  void send(botId, {
                    kind: "wheel",
                    ...pointOf(event),
                    deltaX: Math.round(event.deltaX),
                    deltaY: Math.round(event.deltaY),
                  })
                }
                className={`min-h-0 w-full max-w-7xl flex-1 ${controlling ? "cursor-pointer" : ""}`}
              >
                <Frame
                  jpeg={screen.jpeg}
                  title={screen.title}
                  className="size-full object-contain select-none"
                />
              </div>
              {controlling && (
                <input
                  autoFocus
                  aria-label={t("Type here")}
                  placeholder={t("Type here")}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  onKeyDown={(event) => {
                    if (MODIFIERS.has(event.key)) return;
                    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) return;
                    event.preventDefault();
                    void send(botId, { kind: "key", key: keyOf(event) });
                  }}
                  onInput={(event) => {
                    const text = event.currentTarget.value;
                    event.currentTarget.value = "";
                    if (text) void send(botId, { kind: "text", text });
                  }}
                  className="bg-foreground/6 focus-visible:bg-foreground/10 h-11 w-full max-w-md shrink-0 rounded-xl px-3 text-base outline-none"
                />
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};
