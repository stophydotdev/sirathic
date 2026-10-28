"use client";

import { type Translate, useT } from "@/components/i18n";
import { api } from "@/lib/trpc";
import { currentToolName } from "@sirathic/server/messages";
import { type ThreadMessage, useAuiState } from "@assistant-ui/react";
import { type FC, type ReactNode, useEffect, useState } from "react";
import { z } from "zod";

type Part = ThreadMessage["content"][number];

type Card = {
  title: string;
  arabic: string;
  english: string | undefined;
  surah: number;
  ayah: number;
};

const searchOutput = z.object({
  results: z.object({
    quran: z
      .array(
        z.object({
          ref: z.string(),
          arabic: z.string(),
          english: z.string().nullish(),
        }),
      )
      .default([]),
  }),
});

const quranGetOutput = z.object({
  verses: z.array(
    z.object({
      surah: z.number(),
      ayah: z.number(),
      surahName: z.string(),
      textAr: z.string(),
      textEn: z.string().nullish(),
      isContext: z.boolean().optional(),
    }),
  ),
});

const ayahOf = /(\d+):(\d+)/u;
const footnote = /\[\d+\]/gu;

const quranCard = (
  surah: number,
  ayah: number,
  title: string,
  arabic: string,
  english: string | null | undefined,
): Card => ({
  title,
  arabic,
  english: english?.replaceAll(footnote, ""),
  surah,
  ayah,
});

function cardsFrom(part: Part, t: Translate): Card[] {
  if (part.type !== "tool-call") return [];
  switch (currentToolName(part.toolName)) {
    case "search_web":
      return (searchOutput.safeParse(part.result).data?.results.quran ?? []).flatMap((hit) => {
        const [, surah, ayah] = ayahOf.exec(hit.ref) ?? [];
        return surah && ayah
          ? [quranCard(Number(surah), Number(ayah), hit.ref, hit.arabic, hit.english)]
          : [];
      });
    case "get_verses":
      return (quranGetOutput.safeParse(part.result).data?.verses ?? [])
        .filter((verse) => !verse.isContext)
        .map((verse) =>
          quranCard(
            verse.surah,
            verse.ayah,
            t("Quran {surah}:{ayah} ({name})", {
              surah: verse.surah,
              ayah: verse.ayah,
              name: verse.surahName,
            }),
            verse.textAr,
            verse.textEn,
          ),
        );
    default:
      return [];
  }
}

let arabicSetting: Promise<boolean> | undefined;

function useShowArabic() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    let current = true;
    arabicSetting ??= api.settings.get.query().then(
      (settings) => settings.showArabic,
      () => true,
    );
    void arabicSetting.then((value) => {
      if (current) setShow(value);
    });
    return () => {
      current = false;
    };
  }, []);
  return show;
}

export const InlineVerse: FC<{ url: string; fallback?: ReactNode }> = ({ url, fallback }) => {
  const parts = useAuiState((s) => s.message.parts);
  const showArabic = useShowArabic();
  const t = useT();
  const verse = parts
    .flatMap((part) => cardsFrom(part, t))
    .find((card) => `https://quran.com/${card.surah}/${card.ayah}` === url);
  if (!verse) return fallback;

  return (
    <figure className="my-3 ps-4">
      <figcaption className="text-muted-foreground flex items-center gap-2 text-xs">
        <span className="min-w-0 flex-1 truncate">{verse.title}</span>
      </figcaption>
      {showArabic && (
        <p dir="rtl" lang="ar" className="font-quran mt-1 text-xl leading-loose">
          {verse.arabic}
        </p>
      )}
      {verse.english && (
        <p className="text-muted-foreground mt-1 text-sm leading-6">{verse.english}</p>
      )}
    </figure>
  );
};
