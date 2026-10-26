"use client";

import { useAccount } from "@/components/account";
import { useT } from "@/components/i18n";
import { DeleteFileDialog, PreviewDialog, RenameFileDialog } from "@/components/libraryDialogs";
import { FileRow, FileTile, type LibraryFile } from "@/components/libraryItems";
import { uploadToLibrary } from "@/components/libraryUpload";
import { useSignIn } from "@/components/signIn";
import { TabLink, tabClass } from "@/components/tabLink";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/messages/en";
import {
  FILE_ACCEPT,
  FILE_SORTS,
  type FileKind,
  type FileSort,
  kindOf,
  shownFiles,
} from "@sirathic/server/files";
import { IconAdjustmentsHorizontal, IconFolderPlus, IconSearch, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { type FC, useEffect, useRef, useState } from "react";
import { z } from "zod";

export type Tab = "all" | "media" | "files";

const TAB_KINDS = {
  all: ["image", "pdf", "text"],
  media: ["image"],
  files: ["pdf", "text"],
} as const satisfies Record<Tab, readonly FileKind[]>;

const EMPTY = {
  all: { title: "Your library is empty", hint: "Upload files to keep them within reach." },
  media: { title: "No media yet", hint: "Upload images to see them here." },
  files: { title: "No files yet", hint: "Upload files to see them here." },
} as const satisfies Record<Tab, { title: MessageKey; hint: MessageKey }>;

const SORT_NAMES = {
  created: "Date created",
  name: "Name",
  size: "File size",
} as const satisfies Record<FileSort, MessageKey>;

const ORDERS = {
  created: { desc: "Newest", asc: "Oldest" },
  name: { desc: "Z to A", asc: "A to Z" },
  size: { desc: "Largest", asc: "Smallest" },
} as const satisfies Record<FileSort, Record<"desc" | "asc", MessageKey>>;

const sortName = z.enum(FILE_SORTS);
const orderName = z.enum(["desc", "asc"]);
const viewName = z.enum(["grid", "list"]);

const Tabs: FC<{ tab: Tab }> = ({ tab }) => {
  const t = useT();
  return (
    <div role="tablist" className="flex items-center gap-1">
      <TabLink href="/library" active={tab === "all"}>
        {t("All")}
      </TabLink>
      <TabLink href="/library?tab=media" active={tab === "media"}>
        {t("Media")}
      </TabLink>
      <Link href="/project" className={tabClass(false)}>
        {t("Projects")}
      </Link>
      <TabLink href="/library?tab=files" active={tab === "files"}>
        {t("Files")}
      </TabLink>
    </div>
  );
};

const circleButton =
  "text-muted-foreground hover:bg-muted hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-full transition-colors";

const uploadButton =
  "bg-foreground text-background h-9 rounded-full px-4 text-sm font-medium transition hover:opacity-85 disabled:opacity-60";

export const Library: FC<{ tab: Tab }> = ({ tab }) => {
  const signedIn = useAccount((s) => s.status?.signedIn);
  const ask = useSignIn((s) => s.ask);
  const [files, setFiles] = useState<LibraryFile[]>();
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [view, setView] = useState<z.infer<typeof viewName>>("grid");
  const [sort, setSort] = useState<FileSort>("created");
  const [descending, setDescending] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [previewing, setPreviewing] = useState<LibraryFile>();
  const [renaming, setRenaming] = useState<LibraryFile>();
  const [deleting, setDeleting] = useState<LibraryFile>();
  const picker = useRef<HTMLInputElement>(null);
  const t = useT();

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api.files.list.query().then(
      (found) => {
        if (live) setFiles(found);
      },
      () => {
        if (live) setFiles([]);
      },
    );
    return () => {
      live = false;
    };
  }, [signedIn, version]);

  const refresh = () => setVersion((current) => current + 1);

  const upload = async (picked: File[]) => {
    if (!signedIn) return ask();
    setUploading(true);
    setFailed(false);
    await Promise.all(picked.map((file) => uploadToLibrary(file).catch(() => setFailed(true))));
    setUploading(false);
    refresh();
  };

  const open = (file: LibraryFile) => {
    if (kindOf(file.mediaType) === "image") setPreviewing(file);
    else window.open(`/api/files/${file.id}`, "_blank", "noopener");
  };

  const shown = shownFiles(files ?? [], {
    query,
    kinds: TAB_KINDS[tab],
    sort,
    descending,
  });
  const canUpload = files !== undefined;
  const empty = EMPTY[tab];
  const uploadLabel = uploading ? t("Uploading…") : t("Upload files");

  return (
    <div
      className="relative h-full overflow-y-auto"
      onDragOver={(event) => {
        if (!canUpload || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          event.currentTarget.contains(event.relatedTarget)
        )
          return;
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (canUpload) void upload(Array.from(event.dataTransfer.files));
      }}
    >
      <div className="mx-auto w-full max-w-5xl px-6 pt-16 pb-16 lg:pt-10">
        <h1 className="mb-4 text-2xl font-[580]">{t("Library")}</h1>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Tabs tab={tab} />
          <div className="ms-auto flex items-center gap-2">
            {searching ? (
              <label className="bg-muted/60 flex h-9 w-48 items-center gap-2 rounded-full px-3 sm:w-64">
                <IconSearch className="text-muted-foreground size-4 shrink-0" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setQuery("");
                      setSearching(false);
                    }
                  }}
                  placeholder={t("Search files")}
                  aria-label={t("Search files")}
                  autoFocus
                  className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
                <button
                  type="button"
                  aria-label={t("Clear search")}
                  onClick={() => {
                    setQuery("");
                    setSearching(false);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <IconX className="size-4" />
                </button>
              </label>
            ) : (
              <button
                type="button"
                aria-label={t("Search files")}
                onClick={() => setSearching(true)}
                className={circleButton}
              >
                <IconSearch className="size-4.5" />
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger aria-label={t("View options")} className={circleButton}>
                <IconAdjustmentsHorizontal className="size-4.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuRadioGroup
                  value={view}
                  onValueChange={(value) => setView(viewName.parse(value))}
                >
                  <DropdownMenuRadioItem value="grid">{t("Grid")}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="list">{t("List")}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t("Sort by")}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={sort}
                  onValueChange={(value) => {
                    const next = sortName.parse(value);
                    setSort(next);
                    setDescending(next !== "name");
                  }}
                >
                  {FILE_SORTS.map((name) => (
                    <DropdownMenuRadioItem key={name} value={name}>
                      {t(SORT_NAMES[name])}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t("Order")}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={descending ? "desc" : "asc"}
                  onValueChange={(value) => setDescending(orderName.parse(value) === "desc")}
                >
                  {orderName.options.map((name) => (
                    <DropdownMenuRadioItem key={name} value={name}>
                      {t(ORDERS[sort][name])}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {canUpload && (
              <button
                type="button"
                disabled={uploading}
                onClick={() => picker.current?.click()}
                className={uploadButton}
              >
                {uploadLabel}
              </button>
            )}
          </div>
        </div>
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          accept={FILE_ACCEPT}
          onChange={(event) => {
            void upload(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        {signedIn === false && (
          <button type="button" onClick={() => ask()} className="text-sm underline">
            {t("Sign in to use your library.")}
          </button>
        )}
        {failed && (
          <p className="text-destructive mb-4 text-sm">
            {t("Upload images, PDFs or UTF-8 text files up to 10 MB each.")}
          </p>
        )}
        {files && files.length === 0 && (
          <div className="border-foreground/15 flex flex-col items-center gap-2 rounded-3xl border border-dashed px-6 py-16 text-center">
            <IconFolderPlus className="size-6" />
            <p className="text-sm font-[550]">{t(empty.title)}</p>
            <p className="text-muted-foreground text-sm">{t(empty.hint)}</p>
            <button
              type="button"
              disabled={uploading}
              onClick={() => picker.current?.click()}
              className="bg-muted hover:bg-foreground/10 mt-2 h-9 rounded-full px-4 text-sm font-medium transition-colors disabled:opacity-60"
            >
              {uploadLabel}
            </button>
          </div>
        )}
        {files && files.length > 0 && shown.length === 0 && (
          <p className="text-muted-foreground text-sm">
            {query.trim() ? t("No files match your search.") : t(empty.title)}
          </p>
        )}
        <div
          className={cn(
            view === "grid"
              ? "grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4"
              : "flex flex-col",
          )}
        >
          {shown.map((file) => {
            const item = {
              file,
              onOpen: () => open(file),
              onRename: () => setRenaming(file),
              onDelete: () => setDeleting(file),
            };
            return view === "grid" ? (
              <FileTile key={file.id} {...item} />
            ) : (
              <FileRow key={file.id} {...item} />
            );
          })}
        </div>
      </div>
      {dragging && (
        <div className="border-foreground/30 bg-background/80 pointer-events-none fixed inset-4 z-50 flex items-center justify-center rounded-3xl border-2 border-dashed text-sm font-[550]">
          {t("Drop files to upload")}
        </div>
      )}
      {previewing && <PreviewDialog file={previewing} onClose={() => setPreviewing(undefined)} />}
      {renaming && (
        <RenameFileDialog
          key={renaming.id}
          file={renaming}
          onClose={() => setRenaming(undefined)}
          onDone={refresh}
        />
      )}
      {deleting && (
        <DeleteFileDialog
          key={deleting.id}
          file={deleting}
          onClose={() => setDeleting(undefined)}
          onDone={refresh}
        />
      )}
    </div>
  );
};
