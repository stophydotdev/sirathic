"use client";

import { useParams } from "next/navigation";
import { Chat } from "@/components/chat";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  return <Chat key={id} projectId={id} />;
}
