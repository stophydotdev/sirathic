import type { Metadata } from "next";
import { Tasks } from "@/components/tasks";
import { ThreadShell } from "@/components/threadShell";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <main className="h-dvh">
      <ThreadShell>
        <Tasks />
      </ThreadShell>
    </main>
  );
}
