"use client";

import { useT } from "@/components/i18n";
import { Modal, modalButton, modalPrimaryButton } from "@/components/sessionMenu";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Dialog } from "radix-ui";
import { type FC, type FormEvent, useState } from "react";

export type Skill = Awaited<ReturnType<typeof api.skills.list.query>>[number];

const field =
  "border-border placeholder:text-muted-foreground focus:border-foreground/30 rounded-[10px] border bg-transparent px-3 text-sm outline-none";

export const SkillEditor: FC<{
  skill: Skill | undefined;
  onClose: () => void;
  onSaved: () => void;
}> = ({ skill, onClose, onSaved }) => {
  const [name, setName] = useState(skill?.name ?? "");
  const [instructions, setInstructions] = useState(skill?.instructions ?? "");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const t = useT();

  async function run<Result>(work: () => Promise<Result>) {
    setBusy(true);
    setError(undefined);
    try {
      await work();
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const save = (event: FormEvent) => {
    event.preventDefault();
    void run(() => api.skills.save.mutate({ id: skill?.id, name, instructions }));
  };

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={skill ? t("Edit skill") : t("New skill")}
    >
      <form onSubmit={save} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          {t("Name")}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("My skill")}
            maxLength={40}
            className={cn(field, "h-9")}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          {t("Instructions")}
          <span className="text-muted-foreground text-xs">
            {t("Write what Noor should do when you mention this skill with @.")}
          </span>
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder={t(
              "For example: answer in three short points and quote the strongest hadith first.",
            )}
            maxLength={4000}
            rows={8}
            className={cn(field, "resize-none py-2")}
          />
        </label>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {confirming ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-muted-foreground me-auto text-sm">{t("Delete this skill?")}</span>
            <button type="button" onClick={() => setConfirming(false)} className={modalButton}>
              {t("Cancel")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => skill && void run(() => api.skills.remove.mutate({ id: skill.id }))}
              className={cn(modalPrimaryButton, "bg-destructive text-white")}
            >
              {t("Delete")}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            {skill && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={cn(modalButton, "text-destructive me-auto")}
              >
                {t("Delete")}
              </button>
            )}
            <Dialog.Close type="button" className={modalButton}>
              {t("Cancel")}
            </Dialog.Close>
            <button
              type="submit"
              disabled={busy || !name.trim() || !instructions.trim()}
              className={modalPrimaryButton}
            >
              {t("Save")}
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
};
