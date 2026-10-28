"use client";

import { useAccount } from "@/components/account";
import { useT } from "@/components/i18n";
import { usePreferences } from "@/components/preferences";
import { control, DangerRow, Group, Row, Toggle } from "@/components/settingsControls";
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
  const [busy, setBusy] = useState(false);
  const t = useT();

  const exportData = async () => {
    setBusy(true);
    const data = await api.account.export.query().catch(() => undefined);
    setBusy(false);
    if (!data) return;
    const day = new Date().toISOString().slice(0, 10);
    download(`sirathic-data-${day}.json`, JSON.stringify(data, null, 2));
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
        <Row label={t("Export my data")} hint={t("Chats, memory, bots and settings in one file")}>
          <button
            type="button"
            disabled={busy}
            onClick={() => void exportData()}
            className={cn(control, "disabled:opacity-60")}
          >
            {t("Export")}
          </button>
        </Row>
        <DangerRow
          label={t("Delete all chats")}
          hint={t("Removes every saved chat")}
          question={t("Delete every saved chat? This can't be undone.")}
          action={t("Delete all")}
          onConfirm={async () => {
            await api.sessions.removeAll.mutate();
            await refresh();
            if (window.location.pathname.startsWith("/c/")) startChat();
          }}
        />
      </Group>
    </>
  );
};
