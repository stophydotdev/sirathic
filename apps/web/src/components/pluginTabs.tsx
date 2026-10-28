"use client";

import { useT } from "@/components/i18n";
import { TabLink, TabPill } from "@/components/tabLink";
import type { FC } from "react";

export const PluginTabs: FC<{ tab: "plugins" | "skills" }> = ({ tab }) => {
  const t = useT();
  return (
    <div role="tablist" className="relative flex flex-1 items-center gap-1">
      <TabPill name="plugins" />
      <TabLink href="/plugins" active={tab === "plugins"}>
        {t("Plugins")}
      </TabLink>
      <TabLink href="/plugins?tab=skills" active={tab === "skills"}>
        {t("Skills")}
      </TabLink>
    </div>
  );
};
