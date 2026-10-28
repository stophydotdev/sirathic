"use client";

import { useT } from "@/components/i18n";
import { MemoryFacts } from "@/components/memoryFacts";
import { ImportMemory } from "@/components/settingsImport";
import { Modal, modalButton } from "@/components/sessionMenu";
import { control, Row, Toggle } from "@/components/settingsControls";
import { cn } from "@/lib/utils";
import { api } from "@/lib/trpc";
import type { Settings } from "@sirathic/server/settings";
import { type FC, useEffect, useState } from "react";

const MemoryList: FC<{ onClose: () => void }> = ({ onClose }) => {
  const [memory, setMemory] = useState<readonly string[]>();
  const [confirming, setConfirming] = useState(false);
  const t = useT();

  useEffect(() => {
    let current = true;
    api.settings.get.query().then(
      (loaded) => {
        if (current) setMemory(loaded.memory);
      },
      () => {
        if (current) setMemory([]);
      },
    );
    return () => {
      current = false;
    };
  }, []);

  const keep = (next: readonly string[]) => {
    setMemory(next);
    setConfirming(false);
    void api.settings.update.mutate({ memory: [...next] });
  };

  if (!memory) return null;

  return (
    <>
      <MemoryFacts memory={memory} onChange={keep} />
      {confirming && (
        <p className="text-muted-foreground text-sm">
          {t("Delete everything Sirathic remembers? This can't be undone.")}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {confirming ? (
          <>
            <button type="button" onClick={() => setConfirming(false)} className={modalButton}>
              {t("Cancel")}
            </button>
            <button
              type="button"
              onClick={() => keep([])}
              className={cn(modalButton, "bg-destructive border-0 text-white hover:opacity-90")}
            >
              {t("Delete all")}
            </button>
          </>
        ) : (
          <>
            {memory.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={cn(modalButton, "text-destructive")}
              >
                {t("Delete all")}
              </button>
            )}
            <button type="button" onClick={onClose} className={modalButton}>
              {t("Close")}
            </button>
          </>
        )}
      </div>
    </>
  );
};

type Switches = Pick<Settings, "saveMemory" | "usePastChats">;

export const MemoryRow: FC = () => {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [switches, setSwitches] = useState<Switches>();
  const t = useT();

  useEffect(() => {
    void api.settings.get.query().then(
      ({ saveMemory, usePastChats }) => setSwitches({ saveMemory, usePastChats }),
      () => undefined,
    );
  }, []);

  const flip = (update: Partial<Switches>) => {
    setSwitches((current) => current && { ...current, ...update });
    void api.settings.update.mutate(update);
  };

  return (
    <>
      {switches && (
        <>
          <Row
            label={t("Save new memories")}
            hint={t("Sirathic keeps facts from your chats to answer you better")}
          >
            <Toggle
              label={t("Save new memories")}
              checked={switches.saveMemory}
              onChange={(saveMemory) => flip({ saveMemory })}
            />
          </Row>
          <Row
            label={t("Use past chats")}
            hint={t("Sirathic can look through your earlier chats when it helps")}
          >
            <Toggle
              label={t("Use past chats")}
              checked={switches.usePastChats}
              onChange={(usePastChats) => flip({ usePastChats })}
            />
          </Row>
        </>
      )}
      <Row label={t("Import memory")} hint={t("Bring what another assistant knows about you")}>
        <button type="button" onClick={() => setImporting(true)} className={control}>
          {t("Import")}
        </button>
      </Row>
      <Modal open={importing} onOpenChange={setImporting} title={t("Import memory")}>
        {importing && <ImportMemory onClose={() => setImporting(false)} />}
      </Modal>
      <Row
        label={t("Memory from your chats")}
        hint={t("Facts Sirathic saved to answer you better")}
      >
        <button type="button" onClick={() => setOpen(true)} className={control}>
          {t("Manage")}
        </button>
      </Row>
      <Modal open={open} onOpenChange={setOpen} title={t("Memory from your chats")}>
        {open && <MemoryList onClose={() => setOpen(false)} />}
      </Modal>
    </>
  );
};
