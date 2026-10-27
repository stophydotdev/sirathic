"use client";

import { useT } from "@/components/i18n";
import { api } from "@/lib/trpc";
import { type FC, useEffect, useState } from "react";

export const BotProgress: FC<{ id: string }> = ({ id }) => {
  const t = useT();
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof api.study.progress.query>>>();

  useEffect(() => {
    void api.study.progress
      .query({ id })
      .then(setProgress)
      .catch(() => undefined);
  }, [id]);

  if (!progress || progress.memorized + progress.learning === 0) return null;
  return (
    <section className="bg-card flex flex-col gap-1 rounded-xl p-4">
      <h3 className="text-sm font-medium">{t("Progress")}</h3>
      <p className="text-muted-foreground text-[13px]">
        {t("{count} memorized", { count: progress.memorized })}
        {" · "}
        {t("{count} learning", { count: progress.learning })}
        {" · "}
        {t("{count} due today", { count: progress.due })}
      </p>
    </section>
  );
};
