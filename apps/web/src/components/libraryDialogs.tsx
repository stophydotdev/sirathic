"use client";

import { useT } from "@/components/i18n";
import { fileHref, type LibraryFile } from "@/components/libraryItems";
import { Modal, modalButton, modalPrimaryButton } from "@/components/sessionMenu";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { FILE_NAME_MAX } from "@sirathic/server/files";
import Image from "next/image";
import { Dialog } from "radix-ui";
import { type FC, type FormEvent, useState } from "react";

type DialogProps = {
  file: LibraryFile;
  onClose: () => void;
  onDone: () => void;
};

export const PreviewDialog: FC<{ file: LibraryFile; onClose: () => void }> = ({
  file,
  onClose,
}) => {
  const t = useT();
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={file.name}
      className="max-w-3xl"
    >
      <div className="relative h-[60dvh] w-full">
        <Image
          src={fileHref(file)}
          alt={file.name}
          fill
          unoptimized
          sizes="768px"
          className="object-contain"
        />
      </div>
      <div className="flex justify-end gap-2">
        <a href={fileHref(file)} target="_blank" rel="noopener" className={modalButton}>
          {t("Open in new tab")}
        </a>
        <Dialog.Close type="button" className={modalButton}>
          {t("Close")}
        </Dialog.Close>
      </div>
    </Modal>
  );
};

export const RenameFileDialog: FC<DialogProps> = ({ file, onClose, onDone }) => {
  const [name, setName] = useState(file.name);
  const t = useT();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed && trimmed !== file.name) {
      await api.files.rename.mutate({ id: file.id, name: trimmed }).catch(() => undefined);
      onDone();
    }
    onClose();
  };

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("Rename file")}
    >
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={FILE_NAME_MAX}
          autoFocus
          className="border-border focus-visible:border-foreground/30 h-9 w-full rounded-[8px] border bg-transparent px-3 text-sm outline-none"
        />
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

export const DeleteFileDialog: FC<DialogProps> = ({ file, onClose, onDone }) => {
  const [busy, setBusy] = useState(false);
  const t = useT();

  const confirm = async () => {
    setBusy(true);
    await api.files.remove.mutate({ id: file.id }).catch(() => undefined);
    onDone();
    onClose();
  };

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("Delete file")}
    >
      <p className="text-muted-foreground text-sm">
        {t('Delete "{name}"? Chats that use it will no longer show it.', { name: file.name })}
      </p>
      <div className="flex justify-end gap-2">
        <Dialog.Close type="button" className={modalButton}>
          {t("Cancel")}
        </Dialog.Close>
        <button
          type="button"
          disabled={busy}
          onClick={() => void confirm()}
          className={cn(modalPrimaryButton, "bg-destructive text-white")}
        >
          {t("Delete")}
        </button>
      </div>
    </Modal>
  );
};
