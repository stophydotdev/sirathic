import type { Metadata } from "next";
import { Library } from "@/components/library";
import { ThreadShell } from "@/components/threadShell";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage({ searchParams }: PageProps<"/[lang]/library">) {
  const { tab } = await searchParams;
  return (
    <main className="h-dvh">
      <ThreadShell>
        <Library tab={tab === "media" ? "media" : tab === "files" ? "files" : "all"} />
      </ThreadShell>
    </main>
  );
}
