"use client";

import { prefetchChat } from "@/components/chat";
import { useT } from "@/components/i18n";
import { type Session, useSessions } from "@/components/sessions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  LinkSquare02Icon,
  Loading03Icon,
  Mail01Icon,
  MailOpen01Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  PinIcon,
  PinOffIcon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { type FC, type FormEvent, type ReactNode, useState } from "react";

export const panel =
  "pop bg-background ring-foreground/7 fixed top-1/2 left-1/2 z-[60] flex w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[20px] shadow-lg ring-1 outline-none ring-inset";
export const modalButton =
  "border-border hover:bg-muted flex h-8 items-center justify-center rounded-[8px] border px-3 text-sm font-[470] transition-colors";
export const modalPrimaryButton =
  "bg-primary text-primary-foreground flex h-8 items-center justify-center rounded-[8px] px-3 text-sm font-[470] transition hover:opacity-85 disabled:opacity-60";

export const Modal: FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
}> = ({ open, onOpenChange, title, children, className }) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dim fixed inset-0 z-[60] bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className={cn(panel, "max-w-[440px] gap-4 p-5", className)}
        >
          <Dialog.Title className="text-base font-[470]">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const RenameDialog: FC<{
  session: Session;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ session, open, onOpenChange }) => {
  const t = useT();

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("Rename chat")}>
      <RenameForm session={session} onDone={() => onOpenChange(false)} />
    </Modal>
  );
};

const RenameForm: FC<{ session: Session; onDone: () => void }> = ({ session, onDone }) => {
  const change = useSessions((s) => s.change);
  const [title, setTitle] = useState(session.title);
  const t = useT();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed && trimmed !== session.title) {
      void change(session.id, { title: trimmed });
    }
    onDone();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={80}
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
  );
};

const DeleteDialog: FC<{
  session: Session;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ session, open, onOpenChange }) => {
  const remove = useSessions((s) => s.remove);
  const pathname = usePathname();
  const t = useT();

  const confirm = () => {
    void remove(session.id);
    onOpenChange(false);
    if (pathname === `/c/${session.id}`) window.location.assign("/");
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("Delete chat")}>
      <p className="text-muted-foreground text-sm">
        {t('Delete "{title}"? This can\'t be undone.', {
          title: session.title,
        })}
      </p>
      <div className="flex justify-end gap-2">
        <Dialog.Close type="button" className={modalButton}>
          {t("Cancel")}
        </Dialog.Close>
        <button
          type="button"
          onClick={confirm}
          className={cn(modalPrimaryButton, "bg-destructive text-white")}
        >
          {t("Delete")}
        </button>
      </div>
    </Modal>
  );
};

export const menuItem = "min-h-8 gap-2 rounded-[10px] px-2";
export const menuIcon = "text-muted-foreground size-[18px]";

const SessionMenu: FC<{ session: Session; className?: string }> = ({ session, className }) => {
  const change = useSessions((s) => s.change);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const t = useT();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("Session actions")}
          className={cn(
            "text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-foreground/10 data-[state=open]:text-foreground flex size-5 shrink-0 items-center justify-center rounded-md",
            className,
          )}
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 rounded-[16px] p-1.5">
          <DropdownMenuItem asChild className={menuItem}>
            <a href={`/c/${session.id}`} target="_blank" rel="noreferrer">
              <HugeiconsIcon icon={LinkSquare02Icon} className={menuIcon} />
              {t("Open in new tab")}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRenaming(true)} className={menuItem}>
            <HugeiconsIcon icon={PencilEdit02Icon} className={menuIcon} />
            {t("Rename")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => void change(session.id, { pinned: !session.pinned })}
            className={menuItem}
          >
            {session.pinned ? (
              <HugeiconsIcon icon={PinOffIcon} className={menuIcon} />
            ) : (
              <HugeiconsIcon icon={PinIcon} className={menuIcon} />
            )}
            {session.pinned ? t("Unpin") : t("Pin")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => void change(session.id, { unread: !session.unread })}
            className={menuItem}
          >
            {session.unread ? (
              <HugeiconsIcon icon={MailOpen01Icon} className={menuIcon} />
            ) : (
              <HugeiconsIcon icon={Mail01Icon} className={menuIcon} />
            )}
            {session.unread ? t("Mark as read") : t("Mark as unread")}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleting(true)}
            className={menuItem}
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-[18px]" />
            {t("Delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameDialog session={session} open={renaming} onOpenChange={setRenaming} />
      <DeleteDialog session={session} open={deleting} onOpenChange={setDeleting} />
    </>
  );
};

export const SessionRow: FC<{
  session: Session;
  onOpen?: () => void;
}> = ({ session, onOpen }) => {
  const pathname = usePathname();
  const change = useSessions((s) => s.change);
  const t = useT();
  const [titleShown, setTitleShown] = useState(false);
  const current = pathname === `/c/${session.id}`;

  return (
    <TooltipProvider delayDuration={500}>
      <Tooltip open={titleShown} onOpenChange={setTitleShown}>
        <TooltipTrigger asChild>
          <div
            onPointerDownCapture={() => setTitleShown(false)}
            onFocus={(event) => event.preventDefault()}
            data-row
            data-active={current || undefined}
            className="group/session hover:bg-muted relative flex items-center gap-0.5 rounded-[12px] pe-2 transition-colors"
          >
            <Link
              href={`/c/${session.id}`}
              onClick={onOpen}
              onPointerEnter={() => prefetchChat(session.id)}
              onFocus={() => prefetchChat(session.id)}
              className={cn(
                "text-foreground min-w-0 flex-1 truncate px-2.5 py-2 text-sm group-hover/session:[text-overflow:clip]",
                session.unread && "font-[560]",
              )}
            >
              {session.title}
            </Link>
            {session.working ? (
              <span
                role="status"
                className="text-muted-foreground me-1.5 shrink-0 group-focus-within/session:hidden group-hover/session:hidden group-has-[[data-state=open]]/session:hidden"
              >
                <HugeiconsIcon icon={Loading03Icon} className="size-3 motion-safe:animate-spin" />
                <span className="sr-only">{t("Working")}</span>
              </span>
            ) : (
              session.unread && (
                <span className="bg-super me-2 size-1.5 shrink-0 rounded-full group-focus-within/session:hidden group-hover/session:hidden group-has-[[data-state=open]]/session:hidden" />
              )
            )}
            <button
              type="button"
              aria-label={session.pinned ? t("Unpin") : t("Pin")}
              onClick={() => void change(session.id, { pinned: !session.pinned })}
              className="text-muted-foreground hover:bg-muted hover:text-foreground hidden size-5 shrink-0 items-center justify-center rounded-md group-focus-within/session:flex group-hover/session:flex group-has-[[data-state=open]]/session:flex pointer-coarse:flex"
            >
              {session.pinned ? (
                <HugeiconsIcon icon={PinOffIcon} className="size-3.5" />
              ) : (
                <HugeiconsIcon icon={PinIcon} className="size-3.5" />
              )}
            </button>
            <SessionMenu
              session={session}
              className="hidden group-focus-within/session:flex group-hover/session:flex data-[state=open]:flex pointer-coarse:flex"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {session.title}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
