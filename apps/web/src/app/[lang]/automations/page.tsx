import type { Metadata } from "next";
import { Automations } from "@/components/automations";
import { ThreadShell } from "@/components/threadShell";

export const metadata: Metadata = { title: "Automations" };

export default function AutomationsPage() {
  return (
    <main className="h-dvh">
      <ThreadShell>
        <Automations />
      </ThreadShell>
    </main>
  );
}
