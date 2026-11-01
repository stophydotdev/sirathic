"use client";

import { useLocale, useT } from "@/components/i18n";
import { CONTACT } from "@/components/legalPage";
import { useSettings } from "@/components/settings";
import { control, Group, Row } from "@/components/settingsControls";
import Link from "next/link";
import type { FC } from "react";

const BUILT_AT = process.env.BUILT_AT;

export const AboutSection: FC = () => {
  const setOpen = useSettings((s) => s.setOpen);
  const locale = useLocale();
  const t = useT();

  return (
    <Group>
      <Row label={t("Terms")}>
        <Link href="/terms" onClick={() => setOpen(false)} className={control}>
          {t("Open")}
        </Link>
      </Row>
      <Row label={t("Privacy")}>
        <Link href="/privacy" onClick={() => setOpen(false)} className={control}>
          {t("Open")}
        </Link>
      </Row>
      <Row label={t("Open data")}>
        <Link href="/data" onClick={() => setOpen(false)} className={control}>
          {t("Open")}
        </Link>
      </Row>
      <Row label={t("Contact")} hint={t("Report a wrong answer or a bug")}>
        <a href={`mailto:${CONTACT}`} className={control}>
          {t("Email us")}
        </a>
      </Row>
      {BUILT_AT && (
        <Row
          label={t("Version")}
          hint={t("Built {date}", {
            date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
              new Date(BUILT_AT),
            ),
          })}
        />
      )}
    </Group>
  );
};
