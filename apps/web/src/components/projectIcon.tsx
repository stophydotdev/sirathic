"use client";

import { useT } from "@/components/i18n";
import { useProjects } from "@/components/projects";
import { Modal } from "@/components/sessionMenu";
import { cn } from "@/lib/utils";
import { PROJECT_ICONS } from "@sirathic/server/projects";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  AirplaneIcon,
  Book02Icon,
  Book04Icon,
  Briefcase01Icon,
  BulbIcon,
  Calendar03Icon,
  Coins01Icon,
  Compass01Icon,
  FavouriteIcon,
  FireIcon,
  Folder01Icon,
  FolderOpenIcon,
  Globe02Icon,
  Home01Icon,
  JusticeScale01Icon,
  LanguageSkillIcon,
  Leaf01Icon,
  MapsIcon,
  Moon02Icon,
  MortarboardIcon,
  Mosque01Icon,
  PaintBoardIcon,
  Plant02Icon,
  PrayerRugIcon,
  SourceCodeIcon,
  SparklesIcon,
  StarIcon,
  Sun03Icon,
  TestTube01Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import type { FC } from "react";

const GLYPHS = {
  book: Book02Icon,
  book2: Book04Icon,
  mosque: Mosque01Icon,
  pray: PrayerRugIcon,
  moon: Moon02Icon,
  sun: Sun03Icon,
  star: StarIcon,
  heart: FavouriteIcon,
  leaf: Leaf01Icon,
  plant: Plant02Icon,
  flame: FireIcon,
  bulb: BulbIcon,
  school: MortarboardIcon,
  language: LanguageSkillIcon,
  scale: JusticeScale01Icon,
  users: UserMultipleIcon,
  home: Home01Icon,
  briefcase: Briefcase01Icon,
  coin: Coins01Icon,
  calendar: Calendar03Icon,
  compass: Compass01Icon,
  map: MapsIcon,
  world: Globe02Icon,
  plane: AirplaneIcon,
  code: SourceCodeIcon,
  flask: TestTube01Icon,
  palette: PaintBoardIcon,
  sparkles: SparklesIcon,
} satisfies Record<(typeof PROJECT_ICONS)[number], IconSvgElement>;

export const ProjectIcon: FC<{
  icon: string | null;
  open?: boolean;
  blank?: IconSvgElement;
  className?: string;
}> = ({ icon, open, blank, className }) => {
  const name = PROJECT_ICONS.find((known) => known === icon);
  const glyph = name ? GLYPHS[name] : (blank ?? (open ? FolderOpenIcon : Folder01Icon));
  return <HugeiconsIcon icon={glyph} className={className} />;
};

const cell = "hover:bg-muted flex size-10 items-center justify-center rounded-[10px]";

export const IconPicker: FC<{
  icon: string | null;
  blank?: IconSvgElement;
  blankLabel?: string;
  onPick: (icon: (typeof PROJECT_ICONS)[number] | null) => void;
  onClose: () => void;
}> = ({ icon, blank, blankLabel, onPick, onClose }) => {
  const t = useT();

  const pick = (chosen: (typeof PROJECT_ICONS)[number] | null) => {
    if (chosen !== icon) onPick(chosen);
    onClose();
  };

  return (
    <Modal open onOpenChange={onClose} title={t("Pick new icon")}>
      <div className="grid grid-cols-7 gap-1.5">
        <button
          type="button"
          aria-label={blankLabel ?? t("Folder")}
          aria-pressed={icon === null}
          onClick={() => pick(null)}
          className={cn(cell, icon === null && "bg-muted")}
        >
          <ProjectIcon icon={null} blank={blank} className="size-5" />
        </button>
        {PROJECT_ICONS.map((name) => (
          <button
            key={name}
            type="button"
            aria-label={name}
            aria-pressed={icon === name}
            onClick={() => pick(name)}
            className={cn(cell, icon === name && "bg-muted")}
          >
            <ProjectIcon icon={name} className="size-5" />
          </button>
        ))}
      </div>
    </Modal>
  );
};

export const IconPickerDialog: FC<{
  id: string;
  icon: string | null;
  onClose: () => void;
}> = ({ id, icon, onClose }) => {
  const change = useProjects((s) => s.change);
  return (
    <IconPicker
      icon={icon}
      onPick={(chosen) => void change(id, { icon: chosen })}
      onClose={onClose}
    />
  );
};
