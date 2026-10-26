"use client";

import { messageText } from "@/components/answerActions";
import { useChatState } from "@/components/chat";
import { useT } from "@/components/i18n";
import type { PlainKey } from "@/components/locales";
import { Modal } from "@/components/sessionMenu";
import { useKeyNames, withMod } from "@/lib/keys";
import { useAui } from "@assistant-ui/react";
import { type FC, useEffect } from "react";
import { create } from "zustand";

export const useShortcuts = create<{ open: boolean; setOpen: (open: boolean) => void }>()(
  (set) => ({ open: false, setOpen: (open) => set({ open }) }),
);

const ROWS = [
  ["Send your question", ["Enter"]],
  ["Start a new line", ["shift", "Enter"]],
  ["Choose a mode", ["/"]],
  ["New chat", ["mod", "I"]],
  ["Search chats", ["mod", "K"]],
  ["Stop the answer", ["Esc"]],
  ["Edit your last question", ["↑"]],
  ["Copy the last answer", ["mod", "shift", "C"]],
  ["Show or hide the sidebar", ["mod", "shift", "S"]],
  ["Turn incognito on or off", ["mod", ";"]],
  ["Open settings", ["mod", "shift", ","]],
  ["Keyboard shortcuts", ["mod", "/"]],
] as const satisfies readonly (readonly [PlainKey, readonly string[]])[];

export const ShortcutsSheet: FC = () => {
  const open = useShortcuts((s) => s.open);
  const setOpen = useShortcuts((s) => s.setOpen);
  const names = useKeyNames();
  const t = useT();

  return (
    <Modal open={open} onOpenChange={setOpen} title={t("Keyboard shortcuts")}>
      <div className="-mx-1 flex flex-col">
        {ROWS.map(([label, keys]) => (
          <div key={label} className="flex h-9 items-center justify-between gap-4 px-1 text-sm">
            <span>{t(label)}</span>
            <span className="flex gap-1">
              {keys.map((key) => (
                <kbd
                  key={key}
                  className="bg-muted text-muted-foreground min-w-6 rounded-[6px] px-1.5 py-0.5 text-center font-sans text-xs font-medium"
                >
                  {key === "mod" ? names.mod : key === "shift" ? names.shift : key}
                </kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
};

const isTyping = (event: KeyboardEvent) =>
  event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

export const ThreadKeys: FC = () => {
  const aui = useAui();
  const chat = useChatState();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || document.querySelector("[role=dialog], [role=menu]")) return;
      if (event.key === "Escape" && aui.thread().getState().isRunning) {
        event.preventDefault();
        aui.thread().cancelRun();
      } else if (withMod(event) && event.shiftKey && event.code === "KeyC") {
        const last = chat?.chat.messages.findLast((message) => message.role === "assistant");
        if (!last) return;
        event.preventDefault();
        void navigator.clipboard.writeText(messageText(last));
      } else if (isTyping(event) && document.activeElement === document.body) {
        document.querySelector<HTMLElement>("[data-composer] [contenteditable]")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aui, chat]);

  return null;
};
