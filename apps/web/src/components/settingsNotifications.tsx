"use client";

import { useT } from "@/components/i18n";
import { usePreferences } from "@/components/preferences";
import { control, Group, Row, Toggle } from "@/components/settingsControls";
import type { MessageKey } from "@/messages/en";
import { type FC, useState } from "react";

const permissionOf = () =>
  "Notification" in window ? Notification.permission : ("unsupported" as const);

const STATUS = {
  granted: "Allowed in this browser",
  denied: "Blocked. Turn them on in your browser's site settings",
  default: "Not allowed yet",
  unsupported: "This browser can't show notifications",
} satisfies Record<ReturnType<typeof permissionOf>, MessageKey>;

export const NotificationsSection: FC = () => {
  const [permission, setPermission] = useState(permissionOf);
  const routineAlerts = usePreferences((s) => s.routineAlerts);
  const answerAlerts = usePreferences((s) => s.answerAlerts);
  const change = usePreferences((s) => s.change);
  const t = useT();

  return (
    <Group>
      <Row label={t("Browser notifications")} hint={t(STATUS[permission])}>
        {permission === "default" && (
          <button
            type="button"
            onClick={() => void Notification.requestPermission().then(setPermission)}
            className={control}
          >
            {t("Allow")}
          </button>
        )}
        {permission === "granted" && (
          <button
            type="button"
            onClick={() => new Notification(t("Notifications are on"))}
            className={control}
          >
            {t("Test")}
          </button>
        )}
      </Row>
      <Row label={t("Routine results")} hint={t("When a routine finishes while Sirathic is open")}>
        <Toggle
          label={t("Routine results")}
          checked={routineAlerts}
          onChange={(on) => change({ routineAlerts: on })}
        />
      </Row>
      <Row
        label={t("Answers that finish in another chat")}
        hint={t("When you switch away while an answer is still writing")}
      >
        <Toggle
          label={t("Answers that finish in another chat")}
          checked={answerAlerts}
          onChange={(on) => change({ answerAlerts: on })}
        />
      </Row>
    </Group>
  );
};
