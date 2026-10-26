"use client";

import { useT } from "@/components/i18n";
import { FileKindIcon, type LibraryFile } from "@/components/libraryItems";
import { fileFromLibrary } from "@/components/libraryUpload";
import { menuBox, menuItem } from "@/components/composer";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdownMenu";
import { cn } from "@/lib/utils";
import { api } from "@/lib/trpc";
import { useAui } from "@assistant-ui/react";
import { IconBooks, IconFiles } from "@tabler/icons-react";
import Link from "next/link";
import { type FC, useEffect, useState } from "react";

const RECENT_FILES = 5;

export const RecentFiles: FC = () => {
  const aui = useAui();
  const [files, setFiles] = useState<LibraryFile[]>();
  const t = useT();

  useEffect(() => {
    let live = true;
    api.files.list.query().then(
      (found) => {
        if (live) setFiles(found.slice(0, RECENT_FILES));
      },
      () => {
        if (live) setFiles([]);
      },
    );
    return () => {
      live = false;
    };
  }, []);

  const attach = (file: LibraryFile) =>
    fileFromLibrary(file)
      .then((copy) => aui.thread().composer().addAttachment(copy))
      .catch(() => undefined);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={menuItem}>
        <IconFiles className="size-4" />
        {t("Recent files")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className={cn(menuBox, "w-72")}>
        {files?.length === 0 && (
          <DropdownMenuItem disabled className={menuItem}>
            {t("No recent files")}
          </DropdownMenuItem>
        )}
        {files?.map((file) => (
          <DropdownMenuItem key={file.id} onSelect={() => void attach(file)} className={menuItem}>
            <FileKindIcon mediaType={file.mediaType} className="size-4" />
            <span className="truncate">{file.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className={menuItem}>
          <Link href="/library">
            <IconBooks className="size-4" />
            {t("Library")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};
