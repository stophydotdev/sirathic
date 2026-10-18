"use client";

import { Reader } from "@/components/quran/reader";
import { useParams } from "next/navigation";

export default function SurahPage() {
  const { surah } = useParams<{ surah: string }>();
  return <Reader number={Number(surah)} />;
}
