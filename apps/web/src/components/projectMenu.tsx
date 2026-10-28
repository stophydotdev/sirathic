"use client";

import { useT } from "@/components/i18n";
import { useProjects } from "@/components/projects";
import { Modal, modalButton, modalPrimaryButton } from "@/components/sessionMenu";
import { cn } from "@/lib/utils";
import { Dialog } from "radix-ui";
import { type FC, type FormEvent, useState } from "react";

const field =
  "border-border focus-visible:border-foreground/30 w-full rounded-[8px] border bg-transparent px-3 text-sm outline-none";

export const TextDialog: FC<{
  title: string;
  description?: string;
  placeholder?: string;
  value: string;
  maxLength: number;
  multiline?: boolean;
  required?: boolean;
  validate?: (value: string) => string | undefined;
  onSave: (value: string) => void;
  onClose: () => void;
}> = ({
  title,
  description,
  placeholder,
  value,
  maxLength,
  multiline,
  required,
  validate,
  onSave,
  onClose,
}) => {
  const [text, setText] = useState(value);
  const [error, setError] = useState<string>();
  const t = useT();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (required && !trimmed) return;
    const invalid = validate?.(trimmed);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (trimmed !== value) onSave(trimmed);
    onClose();
  };

  const edit = (next: string) => {
    setText(next);
    setError(undefined);
  };

  return (
    <Modal open onOpenChange={onClose} title={title}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {description && <p className="text-muted-foreground -mt-2 text-sm">{description}</p>}
        {multiline ? (
          <textarea
            value={text}
            onChange={(event) => edit(event.target.value)}
            maxLength={maxLength}
            placeholder={placeholder}
            rows={8}
            aria-label={title}
            autoFocus
            className={`${field} resize-none py-2`}
          />
        ) : (
          <input
            value={text}
            onChange={(event) => edit(event.target.value)}
            maxLength={maxLength}
            aria-label={title}
            aria-invalid={error !== undefined}
            autoFocus
            className={`${field} h-9`}
          />
        )}
        {error && <p className="text-destructive -mt-2 text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <Dialog.Close type="button" className={modalButton}>
            {t("Cancel")}
          </Dialog.Close>
          <button type="submit" className={modalPrimaryButton}>
            {t("Save")}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const DeleteProjectDialog: FC<{
  id: string;
  name: string;
  onClose: () => void;
}> = ({ id, name, onClose }) => {
  const remove = useProjects((s) => s.remove);
  const t = useT();

  const confirm = async () => {
    await remove(id);
    onClose();
    if (window.location.pathname === `/bot/${id}`) {
      window.location.assign("/");
    }
  };

  return (
    <Modal open onOpenChange={onClose} title={t("Delete “{name}”?", { name })}>
      <p className="text-muted-foreground -mt-2 text-sm">
        {t("This permanently deletes the bot and its chat history. This can't be undone.")}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Dialog.Close type="button" className={cn(modalButton, "h-10 rounded-xl")}>
          {t("Cancel")}
        </Dialog.Close>
        <button
          type="button"
          onClick={() => void confirm()}
          className={cn(modalPrimaryButton, "bg-destructive h-10 rounded-xl text-white")}
        >
          {t("Delete")}
        </button>
      </div>
    </Modal>
  );
};
