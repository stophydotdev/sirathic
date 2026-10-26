"use client";

import { useT } from "@/components/i18n";
import { Modal, modalButton, modalPrimaryButton } from "@/components/sessionMenu";
import { api } from "@/lib/trpc";
import { Dialog } from "radix-ui";
import { type FC, type FormEvent, useState } from "react";

const field =
  "border-border placeholder:text-muted-foreground focus:border-foreground/30 h-9 rounded-[10px] border bg-transparent px-3 text-sm outline-none";

export const CustomPlugin: FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}> = ({ open, onOpenChange, onAdded }) => {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = useT();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    try {
      const result = await api.connectors.addCustom.mutate({ name, url });
      if (result.status === "redirect") {
        window.location.assign(result.url);
        return;
      }
      onAdded();
      onOpenChange(false);
      setName("");
      setUrl("");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("Custom plugin")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          {t("Add a name and the address of an MCP server.")}
        </p>
        <label className="flex flex-col gap-1.5 text-sm">
          {t("Name")}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("My plugin")}
            maxLength={40}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          {t("Server URL")}
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://mcp.example.com/mcp"
            inputMode="url"
            className={field}
          />
        </label>
        {failed && (
          <p className="text-destructive text-sm">
            {t("That plugin could not connect. Check the address and try again.")}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Dialog.Close type="button" className={modalButton}>
            {t("Cancel")}
          </Dialog.Close>
          <button
            type="submit"
            disabled={busy || !name.trim() || !url.trim()}
            className={modalPrimaryButton}
          >
            {t("Add plugin")}
          </button>
        </div>
      </form>
    </Modal>
  );
};
