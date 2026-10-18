"use client";

import { useT } from "@/components/i18n";
import {
  preferredLanguage,
  useTafsirLanguage,
} from "@/components/quran/tafsir-language";
import {
  loadWordHelp,
  playWord,
  useWordHelp,
  type WordHelp,
} from "@/components/quran/word-help";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Volume2Icon } from "lucide-react";
import { useEffect, useState } from "react";

export function WordSheet() {
  const selected = useWordHelp((state) => state.selected);
  const select = useWordHelp((state) => state.select);
  const chosen = useTafsirLanguage((state) => state.chosen);
  const [help, setHelp] = useState<WordHelp>();
  const t = useT();

  useEffect(() => {
    if (!selected) return;
    let current = true;
    loadWordHelp(selected.surah, preferredLanguage(chosen)).then(
      (found) => {
        if (current) setHelp(found);
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [selected, chosen]);

  const glosses = selected
    ? help?.ayahs.find((ayah) => ayah.ayah === selected.ayah)
    : undefined;
  const index = (selected?.index ?? 1) - 1;

  return (
    <Sheet open={Boolean(selected)} onOpenChange={(open) => open || select()}>
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        className="gap-3 rounded-t-2xl border-0 px-6 pt-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:inset-x-0 md:bottom-8 md:mx-auto md:w-96 md:rounded-2xl"
      >
        {selected && (
          <>
            <SheetTitle className="text-muted-foreground text-center text-xs font-normal">
              {selected.surah}:{selected.ayah} · word {selected.index}
            </SheetTitle>
            <p
              dir="rtl"
              lang="ar"
              className="text-center text-5xl leading-[1.7]"
            >
              {selected.text}
            </p>
            <p className="text-muted-foreground text-center text-base italic">
              {glosses?.transliteration[index] || "…"}
            </p>
            <p dir="auto" className="text-center text-lg">
              {glosses?.meanings[index] || "…"}
            </p>
            <button
              type="button"
              onClick={() => playWord(selected)}
              className="bg-primary text-primary-foreground mx-auto mt-1 flex h-10 items-center gap-2 rounded-full px-5 text-sm font-[470]"
            >
              <Volume2Icon className="size-4" />
              {t("Listen")}
            </button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
