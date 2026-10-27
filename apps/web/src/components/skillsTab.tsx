"use client";

import { useAccount } from "@/components/account";
import { useT } from "@/components/i18n";
import { type Skill, useOwnLists } from "@/components/ownLists";
import { PluginTabs } from "@/components/pluginTabs";
import { useSignIn } from "@/components/signIn";
import { SkillEditor } from "@/components/skillEditor";
import { HugeiconsIcon } from "@hugeicons/react";
import { MagicWand01Icon } from "@hugeicons/core-free-icons";
import { type FC, useEffect, useState } from "react";

const firstLine = (instructions: string) => instructions.split("\n")[0] ?? "";

export const SkillsTab: FC = () => {
  const signedIn = useAccount((s) => s.status?.signedIn);
  const ask = useSignIn((s) => s.ask);
  const { skills, loaded, load, reload } = useOwnLists();
  const [editing, setEditing] = useState<Skill | "new">();
  const t = useT();

  useEffect(() => {
    if (signedIn) void load();
  }, [signedIn, load]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <PluginTabs tab="skills" />
        <button
          type="button"
          onClick={() => (signedIn ? setEditing("new") : ask())}
          className="bg-foreground text-background h-9 rounded-full px-4 text-sm font-medium transition hover:opacity-85"
        >
          {t("New skill")}
        </button>
      </div>
      {signedIn === false && (
        <button type="button" onClick={() => ask()} className="text-sm underline">
          {t("Sign in to write skills.")}
        </button>
      )}
      {signedIn && loaded && skills.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {t("No skills yet. Write one to reuse your own instructions.")}
        </p>
      )}
      <div className="grid gap-x-10 sm:grid-cols-2">
        {skills.map((skill) => (
          <button
            key={skill.id}
            type="button"
            onClick={() => setEditing(skill)}
            className="flex h-16 min-w-0 items-center gap-3 text-start"
          >
            <span className="bg-muted grid size-9 shrink-0 place-items-center rounded-[10px]">
              <HugeiconsIcon icon={MagicWand01Icon} className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{skill.name}</span>
              <span className="text-muted-foreground truncate text-xs">
                {firstLine(skill.instructions)}
              </span>
            </span>
          </button>
        ))}
      </div>
      {editing && (
        <SkillEditor
          key={editing === "new" ? "new" : editing.id}
          skill={editing === "new" ? undefined : editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => void reload()}
        />
      )}
    </>
  );
};
