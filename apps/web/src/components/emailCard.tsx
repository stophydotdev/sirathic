"use client";

import {
  type ToolCall,
  CardShell,
  fieldClass,
  primaryPill,
  quietPill,
  Row,
} from "@/components/confirmShell";
import { useT } from "@/components/i18n";
import { api } from "@/lib/trpc";
import { outgoingEmail } from "@sirathic/server/email";
import { type FC, useState } from "react";
import type { z } from "zod";

type Email = z.infer<typeof outgoingEmail>;

const wrappedLines = (text: string) =>
  text.split("\n").reduce((rows, line) => rows + Math.max(1, Math.ceil(line.length / 40)), 0);

const addressesIn = (text: string) => text.split(/[\s,;]+/u).filter(Boolean);

export const EmailCard: FC<{
  call: ToolCall;
  email: Email;
  busy: boolean;
  decide: (approved: boolean) => void;
}> = ({ call, email, busy, decide }) => {
  const t = useT();
  const [to, setTo] = useState(email.to.join(", "));
  const [cc, setCc] = useState((email.cc ?? []).join(", "));
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const draft = outgoingEmail.safeParse({
    to: addressesIn(to),
    cc: addressesIn(cc),
    ...(email.bcc && { bcc: email.bcc }),
    subject,
    body,
  });
  const invalid = new Set(draft.error?.issues.map((issue) => issue.path[0]));
  const disabled = busy || saving;

  const send = () => {
    if (!draft.success) return;
    setSaving(true);
    setFailed(false);
    api.emailEdits.save
      .mutate({ toolCallId: call.toolCallId, email: draft.data })
      .then(
        () => decide(true),
        () => setFailed(true),
      )
      .finally(() => setSaving(false));
  };

  return (
    <CardShell
      title={t("New email")}
      status={t("Ready to send")}
      actions={
        <>
          <button
            type="button"
            disabled={disabled || !draft.success}
            onClick={send}
            className={primaryPill}
          >
            {t("Send email")}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => decide(false)}
            className={quietPill}
          >
            {t("Discard")}
          </button>
          {failed && (
            <span className="text-destructive self-center text-xs">
              {t("Could not save your changes. Try again.")}
            </span>
          )}
        </>
      }
    >
      <Row label={t("Send to")}>
        <input
          value={to}
          onChange={(event) => setTo(event.target.value)}
          disabled={disabled}
          aria-invalid={invalid.has("to")}
          aria-label={t("Send to")}
          inputMode="email"
          className={fieldClass}
        />
      </Row>
      <Row label={t("Cc")}>
        <input
          value={cc}
          onChange={(event) => setCc(event.target.value)}
          disabled={disabled}
          aria-invalid={invalid.has("cc")}
          aria-label={t("Cc")}
          inputMode="email"
          className={fieldClass}
        />
      </Row>
      {email.bcc && email.bcc.length > 0 && (
        <Row label={t("Bcc")}>
          <span className="min-w-0 flex-1 px-2.5 py-1.5 wrap-break-word">
            {email.bcc.join(", ")}
          </span>
        </Row>
      )}
      <Row label={t("Subject")}>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          disabled={disabled}
          aria-invalid={invalid.has("subject")}
          aria-label={t("Subject")}
          maxLength={500}
          dir="auto"
          className={fieldClass}
        />
      </Row>
      <div className="px-2.5 py-2">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          disabled={disabled}
          aria-label={t("Message")}
          rows={Math.min(14, Math.max(4, wrappedLines(body) + 1))}
          dir="auto"
          className={`${fieldClass} field-sizing-content max-h-80 w-full resize-none px-3 py-2.5 leading-relaxed`}
        />
      </div>
    </CardShell>
  );
};
