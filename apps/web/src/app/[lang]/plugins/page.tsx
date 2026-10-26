import type { Metadata } from "next";
import { Plugins } from "@/components/plugins";
import { ThreadShell } from "@/components/threadShell";

export const metadata: Metadata = { title: "Plugins" };

export default async function PluginsPage({ searchParams }: PageProps<"/[lang]/plugins">) {
  const { tab } = await searchParams;
  return (
    <main className="h-dvh">
      <ThreadShell>
        <Plugins tab={tab === "skills" ? "skills" : "plugins"} />
      </ThreadShell>
    </main>
  );
}
