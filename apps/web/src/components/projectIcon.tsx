"use client";

import { useT } from "@/components/i18n";
import { useProjects } from "@/components/projects";
import { Modal } from "@/components/sessionMenu";
import { cn } from "@/lib/utils";
import { PROJECT_ICONS } from "@sirathic/server/projects";
import {
  type Icon,
  IconBook,
  IconBook2,
  IconBriefcase,
  IconBuildingMosque,
  IconBulb,
  IconCalendar,
  IconCode,
  IconCoin,
  IconCompass,
  IconFlame,
  IconFlask,
  IconFolder,
  IconFolderOpen,
  IconHeart,
  IconHome,
  IconLanguage,
  IconLeaf,
  IconMap,
  IconMoon,
  IconPalette,
  IconPlane,
  IconPlant,
  IconPray,
  IconSchool,
  IconScale,
  IconSparkles,
  IconStar,
  IconSun,
  IconUsers,
  IconWorld,
} from "@tabler/icons-react";
import type { FC } from "react";

const GLYPHS = {
  book: IconBook,
  book2: IconBook2,
  mosque: IconBuildingMosque,
  pray: IconPray,
  moon: IconMoon,
  sun: IconSun,
  star: IconStar,
  heart: IconHeart,
  leaf: IconLeaf,
  plant: IconPlant,
  flame: IconFlame,
  bulb: IconBulb,
  school: IconSchool,
  language: IconLanguage,
  scale: IconScale,
  users: IconUsers,
  home: IconHome,
  briefcase: IconBriefcase,
  coin: IconCoin,
  calendar: IconCalendar,
  compass: IconCompass,
  map: IconMap,
  world: IconWorld,
  plane: IconPlane,
  code: IconCode,
  flask: IconFlask,
  palette: IconPalette,
  sparkles: IconSparkles,
} satisfies Record<(typeof PROJECT_ICONS)[number], Icon>;

export const ProjectIcon: FC<{
  icon: string | null;
  open?: boolean;
  blank?: Icon;
  className?: string;
}> = ({ icon, open, blank, className }) => {
  const name = PROJECT_ICONS.find((known) => known === icon);
  const Glyph = name ? GLYPHS[name] : (blank ?? (open ? IconFolderOpen : IconFolder));
  return <Glyph className={className} />;
};

const cell = "hover:bg-muted flex size-10 items-center justify-center rounded-[10px]";

export const IconPicker: FC<{
  icon: string | null;
  blank?: Icon;
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
