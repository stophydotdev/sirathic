"use client";

import { useAccount, useCurrentModel } from "@/components/account";
import { EffortPicker } from "@/components/effortPicker";
import { Fold } from "@/components/fold";
import { useT } from "@/components/i18n";
import { TabPill } from "@/components/tabLink";
import { MakerIcon } from "@/components/makerIcon";
import { CustomizeSection } from "@/components/settingsCustomize";
import { DataSection } from "@/components/settingsData";
import { AccountSection, AppearanceSection, BehaviorSection } from "@/components/settingsSections";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdownMenu";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/messages/en";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Cursor01Icon,
  Database01Icon,
  PaintBrush01Icon,
  SlidersHorizontalIcon,
  Tick02Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { Dialog } from "radix-ui";
import { type FC, Fragment, useState } from "react";
import { create } from "zustand";

const SECTIONS = ["account", "appearance", "behavior", "customize", "data"] as const;

type Section = (typeof SECTIONS)[number];

const SECTION_DETAILS = {
  account: { name: "Account", group: "General", icon: UserIcon, Body: AccountSection },
  appearance: {
    name: "Appearance",
    group: "General",
    icon: PaintBrush01Icon,
    Body: AppearanceSection,
  },
  behavior: { name: "Behavior", group: "General", icon: Cursor01Icon, Body: BehaviorSection },
  customize: {
    name: "Customize",
    group: "Sirathic",
    icon: SlidersHorizontalIcon,
    Body: CustomizeSection,
  },
  data: {
    name: "Data controls",
    group: "Data and information",
    icon: Database01Icon,
    Body: DataSection,
  },
} satisfies Record<
  Section,
  {
    name: MessageKey;
    group: MessageKey;
    icon: IconSvgElement;
    Body: FC;
  }
>;

export const useSettings = create<{
  open: boolean;
  section: Section;
  listing: boolean;
  show: (section?: Section) => void;
  list: () => void;
  setOpen: (open: boolean) => void;
}>()((set) => ({
  open: false,
  section: "account",
  listing: true,
  show: (section) =>
    set((current) => ({
      open: true,
      section: section ?? current.section,
      listing: section === undefined,
    })),
  list: () => set({ listing: true }),
  setOpen: (open) => set({ open }),
}));

const modelRow = "h-9 gap-2 rounded-[8px] p-2 text-sm font-[360]";

const GROUPS = [...new Set(SECTIONS.map((item) => SECTION_DETAILS[item].group))];

const closeButton =
  "text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center rounded-[12px] transition-colors";

export const SettingsDialog: FC = () => {
  const open = useSettings((s) => s.open);
  const setOpen = useSettings((s) => s.setOpen);
  const section = useSettings((s) => s.section);
  const listing = useSettings((s) => s.listing);
  const show = useSettings((s) => s.show);
  const list = useSettings((s) => s.list);
  const t = useT();
  const { name, Body } = SECTION_DETAILS[section];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="dim bg-background/70 fixed inset-0 z-50 backdrop-blur-[4px]" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="pop bg-popover border-foreground/6 fixed inset-x-0 bottom-0 z-50 flex h-[calc(100dvh-3rem)] flex-col overflow-hidden rounded-t-[20px] border outline-none md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:h-[640px] md:max-h-[calc(100dvh-2rem)] md:w-[1000px] md:max-w-[calc(100vw-2rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:flex-row md:rounded-[16px]"
        >
          <nav
            aria-label={t("Settings sections")}
            className={cn(
              "border-foreground/6 relative min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2.5 md:flex md:w-[200px] md:flex-none md:border-e",
              listing ? "flex" : "hidden",
            )}
          >
            <div className="flex items-center justify-between ps-2.5 md:hidden">
              <span className="text-[15px] font-semibold">{t("Settings")}</span>
              <Dialog.Close aria-label={t("Close")} className={closeButton}>
                <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
              </Dialog.Close>
            </div>
            <TabPill className="rounded-[10px] max-md:hidden" />
            {GROUPS.map((group) => (
              <div key={group} className="flex flex-col gap-0.5">
                <span className="text-muted-foreground/70 px-2.5 pt-3 pb-1 text-[13px]">
                  {t(group)}
                </span>
                {SECTIONS.filter((item) => SECTION_DETAILS[item].group === group).map((item) => {
                  const { name: label, icon: Icon } = SECTION_DETAILS[item];
                  return (
                    <button
                      key={item}
                      type="button"
                      aria-current={!listing && item === section ? "page" : undefined}
                      data-active={item === section || undefined}
                      onClick={() => show(item)}
                      className="hover:bg-muted relative flex h-12 items-center gap-2.5 rounded-[10px] px-2.5 text-start text-base md:h-8 md:text-sm"
                    >
                      <HugeiconsIcon icon={Icon} className="size-4 shrink-0" />
                      <span className="flex-1">{t(label)}</span>
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        className="text-muted-foreground size-4 md:hidden rtl:rotate-180"
                      />
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className={cn("min-h-0 flex-1 flex-col md:flex", listing ? "hidden" : "flex")}>
            <div className="flex shrink-0 items-center justify-between gap-1 ps-3 pe-3 pt-4 pb-2 md:ps-5">
              <button
                type="button"
                aria-label={t("Back")}
                onClick={list}
                className={cn(closeButton, "md:hidden")}
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4 rtl:rotate-180" />
              </button>
              <Dialog.Title className="flex-1 text-[15px] font-semibold">{t(name)}</Dialog.Title>
              <Dialog.Close aria-label={t("Close")} className={closeButton}>
                <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-8">
              <Body />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const ModelList: FC = () => {
  const models = useAccount((s) => s.models);
  const chosen = useAccount((s) => s.chosen);
  const choose = useAccount((s) => s.choose);
  const t = useT();
  const groups = [
    { label: t("Sirathic"), models: models.filter((model) => model.maker === "sirathic") },
    {
      label: t("From your ChatGPT account"),
      models: models.filter((model) => model.maker !== "sirathic"),
    },
  ].filter((group) => group.models.length > 0);

  return (
    <>
      {models.length === 0 && (
        <DropdownMenuItem disabled className={modelRow}>
          {t("No chat models available")}
        </DropdownMenuItem>
      )}
      {groups.map((group) => (
        <Fragment key={group.label}>
          {groups.length > 1 && (
            <DropdownMenuLabel className="text-muted-foreground px-2 pt-1.5 pb-1 text-xs font-normal">
              {group.label}
            </DropdownMenuLabel>
          )}
          {group.models.map((model) => (
            <DropdownMenuItem
              key={model.slug}
              onSelect={() => choose(model.slug)}
              className={cn(modelRow, "h-7.5 min-h-0! py-0")}
            >
              <span className="min-w-0 flex-1 truncate">{model.name}</span>
              {chosen === model.slug && <HugeiconsIcon icon={Tick02Icon} className="size-4" />}
            </DropdownMenuItem>
          ))}
        </Fragment>
      ))}
    </>
  );
};

const ModelFold: FC = () => {
  const current = useCurrentModel();
  const [open, setOpen] = useState(false);
  const t = useT();

  return (
    <>
      <DropdownMenuItem
        aria-expanded={open}
        onSelect={(event) => {
          event.preventDefault();
          setOpen(!open);
        }}
        className={modelRow}
      >
        {current && <MakerIcon maker={current.maker} className="size-4" />}
        <span className="flex-1">{t("Model")}</span>
        <span className="text-muted-foreground min-w-0 truncate">{current?.name}</span>
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          className={cn(
            "text-muted-foreground size-4 transition-transform duration-300 ease-out-quint rtl:rotate-180 motion-reduce:transition-none",
            open && "rotate-90 rtl:rotate-90",
          )}
        />
      </DropdownMenuItem>
      <Fold open={open}>
        <ModelList />
      </Fold>
    </>
  );
};

export const ModelMenuContent: FC<{
  side?: "top" | "bottom";
}> = ({ side }) => (
  <DropdownMenuContent
    align="end"
    side={side}
    className="ring-foreground/7 max-h-[min(405px,var(--radix-dropdown-menu-content-available-height))] w-70 rounded-[12px] p-1"
  >
    <ModelFold />
    <EffortPicker />
  </DropdownMenuContent>
);
