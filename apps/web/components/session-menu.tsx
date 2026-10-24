"use client";

import { useLocalePath, useT } from "@/components/i18n";
import { findSessions, type Session, useSessions } from "@/components/sessions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  IconDots,
  IconMail,
  IconMailOpened,
  IconPencil,
  IconPin,
  IconPinnedOff,
  IconSearch,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import {
  type FC,
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";

const panel =
  "bg-background ring-foreground/7 fixed top-1/2 left-1/2 z-[60] flex w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[20px] shadow-lg ring-1 outline-none ring-inset";
const button =
  "border-border hover:bg-muted flex h-8 items-center justify-center rounded-[8px] border px-3 text-sm font-[470] transition-colors";
const primaryButton =
  "bg-primary text-primary-foreground flex h-8 items-center justify-center rounded-[8px] px-3 text-sm font-[470] transition hover:opacity-85 disabled:opacity-60";

const Modal: FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
}> = ({ open, onOpenChange, title, children, className }) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/60" />
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
  const change = useSessions((s) => s.change);
  const [title, setTitle] = useState(session.title);
  const t = useT();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed && trimmed !== session.title) {
      void change(session.id, { title: trimmed });
    }
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("Rename chat")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={80}
          autoFocus
          className="border-border focus-visible:border-foreground/30 h-9 w-full rounded-[8px] border bg-transparent px-3 text-sm outline-none"
        />
        <div className="flex justify-end gap-2">
          <Dialog.Close type="button" className={button}>
            {t("Cancel")}
          </Dialog.Close>
          <button type="submit" className={primaryButton}>
            {t("Save")}
          </button>
        </div>
      </form>
    </Modal>
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
  const href = useLocalePath();

  const confirm = () => {
    void remove(session.id);
    onOpenChange(false);
    if (pathname === href(`/s/${session.id}`))
      window.location.assign(href("/"));
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("Delete chat")}>
      <p className="text-muted-foreground text-sm">
        {t('Delete "{title}"? This can\'t be undone.', {
          title: session.title,
        })}
      </p>
      <div className="flex justify-end gap-2">
        <Dialog.Close type="button" className={button}>
          {t("Cancel")}
        </Dialog.Close>
        <button
          type="button"
          onClick={confirm}
          className={cn(primaryButton, "bg-destructive text-white")}
        >
          {t("Delete")}
        </button>
      </div>
    </Modal>
  );
};

const SessionMenu: FC<{ session: Session; className?: string }> = ({
  session,
  className,
}) => {
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
            "text-muted-foreground hover:text-foreground data-[state=open]:text-foreground flex size-6 shrink-0 items-center justify-center rounded-md",
            className,
          )}
        >
          <IconDots className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem
            onSelect={() =>
              void change(session.id, { pinned: !session.pinned })
            }
          >
            {session.pinned ? (
              <IconPinnedOff className="size-4" />
            ) : (
              <IconPin className="size-4" />
            )}
            {session.pinned ? t("Unpin") : t("Pin")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <IconPencil className="size-4" />
            {t("Rename")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              void change(session.id, { unread: !session.unread })
            }
          >
            {session.unread ? (
              <IconMailOpened className="size-4" />
            ) : (
              <IconMail className="size-4" />
            )}
            {session.unread ? t("Mark as read") : t("Mark as unread")}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleting(true)}
          >
            <IconTrash className="size-4" />
            {t("Delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {renaming && (
        <RenameDialog
          session={session}
          open={renaming}
          onOpenChange={setRenaming}
        />
      )}
      <DeleteDialog
        session={session}
        open={deleting}
        onOpenChange={setDeleting}
      />
    </>
  );
};

export const SessionRow: FC<{
  session: Session;
  onOpen?: () => void;
}> = ({ session, onOpen }) => {
  const pathname = usePathname();
  const href = useLocalePath();
  const current = pathname === href(`/s/${session.id}`);

  return (
    <div
      className={cn(
        "group/session hover:bg-muted flex items-center gap-1 rounded-md pe-1",
        current && "bg-muted",
      )}
    >
      <Link
        href={href(`/s/${session.id}`)}
        onClick={onOpen}
        className={cn(
          "text-foreground flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-2.5 py-1 text-base whitespace-nowrap [mask-image:linear-gradient(to_right,#000_calc(100%_-_34px),transparent_calc(100%_-_10px))] rtl:[mask-image:linear-gradient(to_left,#000_calc(100%_-_34px),transparent_calc(100%_-_10px))]",
          session.unread && "font-[560]",
        )}
      >
        <span>{session.title}</span>
        {session.unread && (
          <span className="bg-super size-1.5 shrink-0 rounded-full" />
        )}
      </Link>
      <SessionMenu
        session={session}
        className="hidden group-focus-within/session:flex group-hover/session:flex data-[state=open]:flex pointer-coarse:flex"
      />
    </div>
  );
};

export const SearchDialog: FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Session[]>([]);
  const t = useT();
  const href = useLocalePath();

  useEffect(() => {
    if (!open) return;
    let current = true;
    const timer = setTimeout(
      () =>
        void findSessions(query.trim()).then((sessions) => {
          if (current) setFound(sessions);
        }),
      150,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [open, query]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className={cn(panel, "top-[20%] max-w-[560px] translate-y-0")}
        >
          <Dialog.Title className="sr-only">{t("Search chats")}</Dialog.Title>
          <div className="border-border/50 flex items-center gap-2 border-b px-4">
            <IconSearch className="text-muted-foreground size-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("Search chats…")}
              autoFocus
              onKeyDown={(event) => {
                const first = found[0];
                if (event.key === "Enter" && first) {
                  window.location.assign(href(`/s/${first.id}`));
                }
              }}
              className="placeholder:text-muted-foreground h-12 flex-1 bg-transparent text-sm outline-none"
            />
            <Dialog.Close
              aria-label={t("Close")}
              className="text-muted-foreground hover:text-foreground"
            >
              <IconX className="size-4" />
            </Dialog.Close>
          </div>
          <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto p-2">
            {found.length === 0 && (
              <p className="text-muted-foreground px-2.5 py-2 text-sm">
                {t("No chats found")}
              </p>
            )}
            {found.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                onOpen={() => onOpenChange(false)}
              />
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
