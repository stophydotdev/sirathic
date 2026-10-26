import type { Metadata } from "next";
import { ProjectsPage } from "@/components/projectsPage";
import { ThreadShell } from "@/components/threadShell";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsRoute() {
  return (
    <main className="h-dvh">
      <ThreadShell>
        <ProjectsPage />
      </ThreadShell>
    </main>
  );
}
