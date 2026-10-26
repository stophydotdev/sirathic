"use client";

import { useT } from "@/components/i18n";
import { DeleteFileDialog } from "@/components/libraryDialogs";
import { FileKindIcon, fileHref, type LibraryFile } from "@/components/libraryItems";
import { uploadToLibrary } from "@/components/libraryUpload";
import { pill } from "@/components/projectMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { FILE_ACCEPT, kindOf } from "@sirathic/server/files";
import { IconDots } from "@tabler/icons-react";
import Image from "next/image";
import { type FC, useEffect, useRef, useState } from "react";

const TEXT_PREVIEW_CHARS = 100_000;

export const useProjectFiles = (projectId: string) => {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [version, setVersion] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    api.files.list.query({ projectId }).then(
      (found) => {
        if (live) setFiles(found);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [projectId, version]);

  const refresh = () => setVersion((current) => current + 1);

  const add = async (picked: File[]) => {
    setUploading(true);
    setFailed(false);
    await Promise.all(
      picked.map((file) => uploadToLibrary(file, projectId).catch(() => setFailed(true))),
    );
    setUploading(false);
    refresh();
  };

  return { files, refresh, add, uploading, failed };
};

const FileRowMenu: FC<{ file: LibraryFile; onOpen: () => void; onRemove: () => void }> = ({
  file,
  onOpen,
  onRemove,
}) => {
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${t("File actions")}: ${file.name}`}
        className="text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-foreground/10 flex size-7 shrink-0 items-center justify-center rounded-full transition-colors"
      >
        <IconDots className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onSelect={onOpen}>{t("Open")}</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onRemove}>
          {t("Remove")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const ProjectFilesSection: FC<{
  project: ReturnType<typeof useProjectFiles>;
  onOpen: (file: LibraryFile) => void;
}> = ({ project, onOpen }) => {
  const [removing, setRemoving] = useState<LibraryFile>();
  const picker = useRef<HTMLInputElement>(null);
  const t = useT();

  return (
    <section className="flex flex-col gap-3 py-4">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="text-sm font-medium">{t("Files")}</h3>
          <p className="text-muted-foreground text-[13px]">
            {t("Add files for Noor to use in this project")}
          </p>
        </div>
        <button
          type="button"
          disabled={project.uploading}
          onClick={() => picker.current?.click()}
          className={cn(pill, "disabled:opacity-60")}
        >
          {project.uploading ? t("Uploading…") : t("Add")}
        </button>
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          accept={FILE_ACCEPT}
          onChange={(event) => {
            void project.add(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </div>
      {project.failed && (
        <p className="text-destructive text-sm">
          {t("Upload images, PDFs or UTF-8 text files up to 10 MB each.")}
        </p>
      )}
      {project.files.length > 0 && (
        <ul className="border-foreground/10 divide-foreground/10 divide-y rounded-[10px] border">
          {project.files.map((file) => (
            <li key={file.id} className="flex items-center gap-1 ps-3 pe-1.5">
              <button
                type="button"
                onClick={() => onOpen(file)}
                className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-start"
              >
                <FileKindIcon
                  mediaType={file.mediaType}
                  className="text-muted-foreground size-4 shrink-0"
                />
                <span className="truncate text-sm">{file.name}</span>
              </button>
              <FileRowMenu
                file={file}
                onOpen={() => onOpen(file)}
                onRemove={() => setRemoving(file)}
              />
            </li>
          ))}
        </ul>
      )}
      {removing && (
        <DeleteFileDialog
          key={removing.id}
          file={removing}
          onClose={() => setRemoving(undefined)}
          onDone={project.refresh}
        />
      )}
    </section>
  );
};

const TextPreview: FC<{ file: LibraryFile }> = ({ file }) => {
  const [text, setText] = useState("");
  const href = fileHref(file);

  useEffect(() => {
    let live = true;
    fetch(href)
      .then((response) => response.text())
      .then((body) => {
        if (live) setText(body.slice(0, TEXT_PREVIEW_CHARS));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [href]);

  return <pre className="p-4 font-mono text-[13px] break-words whitespace-pre-wrap">{text}</pre>;
};

const Preview: FC<{ file: LibraryFile }> = ({ file }) => {
  const kind = kindOf(file.mediaType);
  if (kind === "text") return <TextPreview key={file.id} file={file} />;
  if (kind === "pdf") {
    return (
      <iframe
        key={file.id}
        src={fileHref(file)}
        title={file.name}
        className="absolute inset-0 size-full"
      />
    );
  }
  return (
    <div className="absolute inset-0">
      <Image
        key={file.id}
        src={fileHref(file)}
        alt={file.name}
        fill
        unoptimized
        sizes="600px"
        className="object-contain"
      />
    </div>
  );
};

export const ProjectFilesTab: FC<{
  files: LibraryFile[];
  selected: LibraryFile | undefined;
  onSelect: (file: LibraryFile) => void;
}> = ({ files, selected, onSelect }) => {
  const t = useT();

  if (!selected) {
    return <p className="text-muted-foreground px-4 py-6 text-sm">{t("No files yet")}</p>;
  }

  return (
    <div className="flex size-full min-h-0 flex-col sm:flex-row">
      <ul className="border-foreground/10 flex max-h-40 shrink-0 flex-col gap-0.5 overflow-y-auto border-b p-2 sm:max-h-none sm:w-[170px] sm:border-e sm:border-b-0">
        {files.map((file) => (
          <li key={file.id}>
            <button
              type="button"
              onClick={() => onSelect(file)}
              aria-current={file.id === selected.id}
              title={file.name}
              className={cn(
                "hover:bg-muted flex w-full min-w-0 items-center gap-2 rounded-[8px] px-2 py-1.5 text-start text-sm",
                file.id === selected.id && "bg-muted",
              )}
            >
              <FileKindIcon
                mediaType={file.mediaType}
                className="text-muted-foreground size-4 shrink-0"
              />
              <span className="truncate">{file.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="relative min-h-0 min-w-0 flex-1 overflow-auto">
        <Preview file={selected} />
      </div>
    </div>
  );
};
