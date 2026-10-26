"use client";

import { useT } from "@/components/i18n";
import { TabLink } from "@/components/tabLink";
import type { FC } from "react";

export const PluginTabs: FC<{ tab: "plugins" | "skills" }> = ({ tab }) => {
  const t = useT();
  return (
    <div role="tablist" className="flex flex-1 items-center gap-1">
      <TabLink href="/plugins" active={tab === "plugins"}>
        {t("Plugins")}
      </TabLink>
      <TabLink href="/plugins?tab=skills" active={tab === "skills"}>
        {t("Skills")}
      </TabLink>
    </div>
  );
};
