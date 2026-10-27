"use client";

import { useAccount } from "@/components/account";
import { useT } from "@/components/i18n";
import { usePreferences } from "@/components/preferences";
import { control, Group, Row, Toggle } from "@/components/settingsControls";
import { MemoryRow } from "@/components/settingsMemory";
import { useSessions } from "@/components/sessions";
import { useStartChat } from "@/components/newChat";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { type FC, useState } from "react";

function download(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export const DataSection: FC = () => {
  const signedIn = useAccount((s) => s.status?.signedIn === true);
  const incognitoByDefault = usePreferences((s) => s.incognitoByDefault);
  const change = usePreferences((s) => s.change);
  const refresh = useSessions((s) => s.refresh);
  const startChat = useStartChat();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = useT();

  const exportChats = async () => {
    setBusy(true);
    const chats = await api.sessions.export.query().catch(() => undefined);
    setBusy(false);
    if (!chats) return;
    const day = new Date().toISOString().slice(0, 10);
    download(`sirathic-chats-${day}.json`, JSON.stringify(chats, null, 2));
  };

  const deleteAll = async () => {
    setBusy(true);
    await api.sessions.removeAll.mutate().catch(() => undefined);
    await refresh();
    setBusy(false);
    setConfirming(false);
    if (window.location.pathname.startsWith("/c/")) startChat();
  };

  return (
    <>
      <Group>
        <Row
          label={t("Incognito by default")}
          hint={t("New chats start in incognito and aren't saved")}
        >
          <Toggle
            label={t("Incognito by default")}
            checked={incognitoByDefault}
            onChange={(on) => change({ incognitoByDefault: on })}
          />
        </Row>
        {signedIn && <MemoryRow />}
      </Group>
      <Group>
        <Row label={t("Export my chats")} hint={t("Download every saved chat as a file")}>
          <button
            type="button"
            disabled={busy}
            onClick={() => void exportChats()}
            className={cn(control, "disabled:opacity-60")}
          >
            {t("Export")}
          </button>
        </Row>
        <Row
          label={t("Delete all chats")}
          hint={
            confirming
              ? t("Delete every saved chat? This can't be undone.")
              : t("Removes every saved chat")
          }
        >
          {confirming ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirming(false)} className={control}>
                {t("Cancel")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void deleteAll()}
                className={cn(
                  control,
                  "bg-destructive border-0 text-white hover:opacity-90 disabled:opacity-60",
                )}
              >
                {t("Delete all")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={cn(control, "text-destructive")}
            >
              {t("Delete all")}
            </button>
          )}
        </Row>
      </Group>
    </>
  );
};
