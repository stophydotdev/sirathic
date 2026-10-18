"use client";

import { useT } from "@/components/i18n";
import { RECITERS, reciterName, usePlayer } from "@/components/quran/player";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ChevronDownIcon,
  PauseIcon,
  PlayIcon,
  Repeat1Icon,
  SkipBackIcon,
  SkipForwardIcon,
  XIcon,
} from "lucide-react";
import type { FC } from "react";

const control =
  "text-muted-foreground hover:bg-muted hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40";

export const PlayerBar: FC = () => {
  const recitation = usePlayer((s) => s.recitation);
  const t = useT();
  const ayah = usePlayer((s) => s.ayah);
  const playing = usePlayer((s) => s.playing);
  const progress = usePlayer((s) => s.progress);
  const reciter = usePlayer((s) => s.reciter);
  const speed = usePlayer((s) => s.speed);
  const repeat = usePlayer((s) => s.repeat);
  const loop = usePlayer((s) => s.loop);
  if (!recitation || ayah === undefined) return null;
  const player = usePlayer.getState();

  return (
    <div className="bg-background border-border/60 shrink-0 border-t px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] print:hidden">
      <div className="bg-foreground/10 h-0.5 overflow-hidden rounded-full">
        <div
          className="bg-super h-full transition-[width] duration-200"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="mx-auto mt-2 flex max-w-[720px] items-center gap-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-[470] tabular-nums">
            {recitation.name} {recitation.surah}:{ayah}
            {(recitation.times ?? 1) > 1 && (
              <span className="text-muted-foreground">
                {" "}
                · {loop}/{recitation.times}
              </span>
            )}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger className="text-muted-foreground hover:text-foreground flex min-w-0 items-center gap-1 text-xs">
              <span className="truncate">{reciterName(reciter)}</span>
              <ChevronDownIcon className="size-3 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-64">
              <DropdownMenuLabel>{t("Reciter")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={reciter}
                onValueChange={(value) => {
                  const chosen = RECITERS.find((r) => r.id === value);
                  if (chosen) player.setReciter(chosen.id);
                }}
              >
                {RECITERS.map((option) => (
                  <DropdownMenuRadioItem key={option.id} value={option.id}>
                    {option.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <button
          type="button"
          onClick={player.previous}
          disabled={ayah <= recitation.from}
          aria-label={t("Previous ayah")}
          className={control}
        >
          <SkipBackIcon className="size-4 fill-current" />
        </button>
        <button
          type="button"
          onClick={player.toggle}
          aria-label={playing ? t("Pause") : t("Play")}
          className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-full"
        >
          {playing ? (
            <PauseIcon className="size-4 fill-current" />
          ) : (
            <PlayIcon className="size-4 fill-current" />
          )}
        </button>
        <button
          type="button"
          onClick={player.next}
          disabled={ayah >= recitation.to}
          aria-label={t("Next ayah")}
          className={control}
        >
          <SkipForwardIcon className="size-4 fill-current" />
        </button>
        <button
          type="button"
          onClick={player.cycleSpeed}
          aria-label={t("Playback speed")}
          className={cn(control, "w-11 text-xs tabular-nums")}
        >
          {speed}x
        </button>
        <button
          type="button"
          onClick={player.toggleRepeat}
          aria-pressed={repeat}
          aria-label={t("Repeat this ayah")}
          className={cn(control, repeat && "text-super hover:text-super")}
        >
          <Repeat1Icon className="size-4" />
        </button>
        <button
          type="button"
          onClick={player.stop}
          aria-label={t("Close player")}
          className={control}
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  );
};
