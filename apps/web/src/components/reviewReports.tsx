"use client";

import { formatInstant } from "@/components/automationText";
import { useLocale, useT } from "@/components/i18n";
import { Logo } from "@/components/logo";
import { PublishedAnswers } from "@/components/publishedPage";
import { REASONS } from "@/components/reportMistake";
import { api } from "@/lib/trpc";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type FC, useEffect, useState } from "react";

type Reports = Awaited<ReturnType<typeof api.review.reports.query>>;

export const ReviewReports: FC = () => {
  const [reports, setReports] = useState<Reports>();
  const [refused, setRefused] = useState(false);
  const locale = useLocale();
  const t = useT();

  useEffect(() => {
    api.review.reports.query().then(setReports, () => setRefused(true));
  }, []);

  if (refused) notFound();

  return (
    <main className="min-h-dvh">
      <header className="border-border/60 flex items-center justify-between border-b px-5 py-3.5 md:px-10">
        <Link href="/" className="text-foreground">
          <Logo height={20} />
        </Link>
      </header>
      <div className="mx-auto w-full max-w-182 px-5 pt-12 pb-20">
        <h1 className="text-foreground text-3xl font-medium tracking-tight">
          {t("Shared reports")}
        </h1>
        {reports?.length === 0 && (
          <p className="text-muted-foreground mt-6 text-sm">{t("No shared reports yet.")}</p>
        )}
        <ul className="mt-8 flex flex-col gap-10">
          {reports?.map((report) => (
            <li key={report.id} className="border-border/60 rounded-[16px] border p-5">
              <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="bg-muted rounded-full px-2 py-0.5 font-medium">
                  {t(REASONS.find(([value]) => value === report.reason)?.[1] ?? "Something else")}
                </span>
                <time dateTime={report.at}>{formatInstant(locale, report.at)}</time>
              </div>
              {report.details && (
                <p className="text-foreground mt-4 text-sm whitespace-pre-wrap">{report.details}</p>
              )}
              <h2 className="text-foreground mt-6 text-xl font-medium">{report.question}</h2>
              <PublishedAnswers
                turns={[{ question: report.question, answer: report.answer }]}
                sources={report.sources}
              />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
};
