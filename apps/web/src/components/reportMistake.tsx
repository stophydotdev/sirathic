"use client";

import type { PlainKey } from "@/components/locales";
import { useT } from "@/components/i18n";
import { Modal, modalButton, modalPrimaryButton } from "@/components/sessionMenu";
import type { Report } from "@sirathic/server/messages";
import { Dialog } from "radix-ui";
import { type FC, type FormEvent, useState } from "react";

const REASONS = [
  ["quote", "A verse or hadith is wrong"],
  ["school", "A school's view is wrong"],
  ["source", "A source doesn't say this"],
  ["ruling", "It gives a personal ruling"],
  ["other", "Something else"],
] as const satisfies readonly (readonly [Report["reason"], PlainKey])[];

export const ReportMistake: FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (report: Report) => void;
}> = ({ open, onOpenChange, onSend }) => {
  const [reason, setReason] = useState<Report["reason"]>();
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  const t = useT();

  const change = (next: boolean) => {
    onOpenChange(next);
    if (next) return;
    setReason(undefined);
    setDetails("");
    setSent(false);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!reason) return;
    onSend({ reason, details: details.trim() || undefined });
    setSent(true);
  };

  if (sent) {
    return (
      <Modal
        open={open}
        onOpenChange={change}
        title={t("Thanks. We read every report and fix what's wrong.")}
      >
        <div className="flex justify-end">
          <Dialog.Close type="button" className={modalPrimaryButton}>
            {t("Close")}
          </Dialog.Close>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onOpenChange={change} title={t("What's wrong with this answer?")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div role="radiogroup" className="-mx-2 flex flex-col">
          {REASONS.map(([value, label]) => (
            <label
              key={value}
              className="hover:bg-muted flex h-9 items-center gap-3 rounded-[8px] px-2 text-sm"
            >
              <input
                type="radio"
                name="reason"
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                className="accent-foreground size-4"
              />
              {t(label)}
            </label>
          ))}
        </div>
        <textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder={t("Add details (optional)")}
          maxLength={1000}
          rows={3}
          className="border-border placeholder:text-muted-foreground focus:border-foreground/30 resize-none rounded-[12px] border bg-transparent px-3 py-2 text-sm outline-none"
        />
        <div className="flex justify-end gap-2">
          <Dialog.Close type="button" className={modalButton}>
            {t("Cancel")}
          </Dialog.Close>
          <button type="submit" disabled={!reason} className={modalPrimaryButton}>
            {t("Send report")}
          </button>
        </div>
      </form>
    </Modal>
  );
};
