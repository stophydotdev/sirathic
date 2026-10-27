"use client";

import { useT } from "@/components/i18n";
import { api } from "@/lib/trpc";
import { HugeiconsIcon } from "@hugeicons/react";
import { Clock04Icon } from "@hugeicons/core-free-icons";
import { usePathname } from "next/navigation";
import { type FC, useEffect, useState } from "react";
import { z } from "zod";

const SEEN_KEY = "sirathicAutomationsSeen";
const CHECK_MS = 30_000;

const announced = new Set<string>();
let primed = false;

const readSeen = () => {
  try {
    return z.coerce.number().catch(0).parse(localStorage.getItem(SEEN_KEY));
  } catch {
    return 0;
  }
};

const writeSeen = () => {
  try {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    return;
  }
};

export const askNotifications = () => {
  if ("Notification" in window && Notification.permission === "default") {
    void Notification.requestPermission();
  }
};

const announce = (id: string, title: string, body: string) => {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const note = new Notification(title, { body, tag: id });
  note.addEventListener(
    "click",
    () => {
      window.focus();
      window.location.assign(`/c/${id}`);
      note.close();
    },
    { once: true },
  );
};

export function useUnseenRuns(signedIn: boolean | undefined) {
  const t = useT();
  const viewing = usePathname().split("/").includes("automations");
  const [unseen, setUnseen] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    const check = async () => {
      const runs = await api.automations.runs.query().catch(() => undefined);
      if (!runs) return;
      if (viewing || readSeen() === 0) writeSeen();
      const seenAt = readSeen();
      const alerting = runs.filter((run) => run.notify === "app");
      setUnseen(alerting.some((run) => Date.parse(run.createdAt) > seenAt));
      for (const run of alerting) {
        if (announced.has(run.id)) continue;
        announced.add(run.id);
        if (primed) announce(run.id, run.title, t("Finished. Open to read the answer."));
      }
      primed = true;
    };
    void check();
    const timer = setInterval(() => void check(), CHECK_MS);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [signedIn, viewing, t]);

  return signedIn === true && !viewing && unseen;
}

export const UnseenDot: FC = () => {
  const t = useT();
  return (
    <>
      <span
        aria-hidden
        className="bg-foreground ring-sidebar absolute -end-0.5 -top-0.5 size-2 rounded-full ring-2"
      />
      <span className="sr-only">{t("New automation answers")}</span>
    </>
  );
};

export const AutomationsIcon: FC<{ unseen: boolean; className: string }> = ({
  unseen,
  className,
}) => (
  <span className="relative shrink-0">
    <HugeiconsIcon icon={Clock04Icon} className={className} />
    {unseen && <UnseenDot />}
  </span>
);
