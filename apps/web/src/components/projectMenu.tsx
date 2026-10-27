"use client";

import { useT } from "@/components/i18n";
import { IconPickerDialog } from "@/components/projectIcon";
import { type Project, projectNameError, useProjects } from "@/components/projects";
import { Modal, modalButton, modalPrimaryButton } from "@/components/sessionMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { PROJECT_NAME_MAX } from "@sirathic/server/projects";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  SmileIcon,
} from "@hugeicons/core-free-icons";
import { Dialog } from "radix-ui";
import { type FC, type FormEvent, useState } from "react";

export const pill =
  "border-foreground/15 hover:bg-muted flex h-8 shrink-0 items-center rounded-full border px-2.5 text-sm font-medium";

export const field =
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
  bot?: boolean;
  onClose: () => void;
}> = ({ id, name, bot, onClose }) => {
  const remove = useProjects((s) => s.remove);
  const t = useT();

  const confirm = async () => {
    await remove(id);
    onClose();
    if ([`/project/${id}`, `/bot/${id}`].includes(window.location.pathname)) {
      window.location.assign("/");
    }
  };

  return (
    <Modal open onOpenChange={onClose} title={bot ? t("Delete bot") : t("Delete project")}>
      <p className="text-muted-foreground text-sm">
        {bot
          ? t('Delete the bot "{name}"? Its conversation stays in your history.', { name })
          : t('Delete the project "{name}"? Its chats stay in your history.', { name })}
      </p>
      <div className="flex justify-end gap-2">
        <Dialog.Close type="button" className={modalButton}>
          {t("Cancel")}
        </Dialog.Close>
        <button
          type="button"
          onClick={() => void confirm()}
          className={`${modalPrimaryButton} bg-destructive text-white`}
        >
          {t("Delete")}
        </button>
      </div>
    </Modal>
  );
};

export const ProjectActions: FC<{
  project: Project;
  align: "start" | "end";
  triggerClassName: string;
}> = ({ project, align, triggerClassName }) => {
  const change = useProjects((s) => s.change);
  const [editing, setEditing] = useState<"name" | "icon" | "delete">();
  const t = useT();
  const close = () => setEditing(undefined);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={t("More actions")} className={triggerClassName}>
          <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-44">
          <DropdownMenuItem onSelect={() => setEditing("name")}>
            <HugeiconsIcon icon={PencilEdit02Icon} className="size-4" />
            {t("Rename")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEditing("icon")}>
            <HugeiconsIcon icon={SmileIcon} className="size-4" />
            {t("Edit icon")}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setEditing("delete")}>
            <HugeiconsIcon icon={Delete02Icon} className="size-4" />
            {t("Delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editing === "name" && (
        <TextDialog
          title={t("Rename project")}
          value={project.name}
          maxLength={PROJECT_NAME_MAX}
          required
          validate={(name) => projectNameError(t, name)}
          onSave={(name) => void change(project.id, { name })}
          onClose={close}
        />
      )}
      {editing === "icon" && (
        <IconPickerDialog id={project.id} icon={project.icon} onClose={close} />
      )}
      {editing === "delete" && (
        <DeleteProjectDialog id={project.id} name={project.name} onClose={close} />
      )}
    </>
  );
};
