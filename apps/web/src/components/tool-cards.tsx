"use client";

import { type Translate, useT } from "@/components/i18n";
import type { MessageKey } from "@/messages/en";
import { cn } from "@/lib/utils";
import { type ThreadMessage, useAuiState } from "@assistant-ui/react";
import { IconNavigation } from "@tabler/icons-react";
import { type FC, type ReactNode, useEffect, useState } from "react";
import { z } from "zod";

type Part = ThreadMessage["content"][number];

const prayerTime = z.object({ time: z.string(), iso: z.string() }).nullable();

const prayerTimesOutput = z.object({
  date: z.string(),
  timezone: z.string(),
  times: z.object({
    fajr: prayerTime,
    sunrise: prayerTime,
    dhuhr: prayerTime,
    asr: prayerTime,
    maghrib: prayerTime,
    isha: prayerTime,
  }),
  basis: z.object({
    method: z.object({ name: z.string() }),
    asr: z.object({ school: z.string() }),
  }),
});

const qiblaOutput = z.object({
  bearingDegrees: z.number(),
  compass: z.string(),
  distanceToKaabaKm: z.number(),
  atTheKaaba: z.boolean(),
});

const zakatOutput = z.object({
  status: z.literal("ok"),
  currency: z.string(),
  assets: z.object({
    cash: z.number(),
    gold: z.number(),
    silver: z.number(),
    investments: z.number(),
    businessStock: z.number(),
    receivables: z.number(),
  }),
  netZakatableWealth: z.number(),
  rate: z.number(),
  selectedBasis: z.enum(["gold", "silver"]),
  zakatDue: z.number(),
  byBasis: z.object({
    gold: z.object({ nisabGrams: z.number(), nisabValue: z.number() }),
    silver: z.object({ nisabGrams: z.number(), nisabValue: z.number() }),
  }),
});

const inheritanceOutput = z.object({
  estate: z.object({ distributable: z.number(), currency: z.string() }),
  heirs: z.array(
    z.object({
      label: z.string(),
      count: z.number(),
      fraction: z.string(),
      amount: z.number(),
      each: z.object({ amount: z.number() }).nullable(),
    }),
  ),
  excluded: z.array(z.object({ label: z.string() })).default([]),
});

const PRAYERS = [
  ["fajr", "Fajr"],
  ["sunrise", "Sunrise"],
  ["dhuhr", "Dhuhr"],
  ["asr", "Asr"],
  ["maghrib", "Maghrib"],
  ["isha", "Isha"],
] as const satisfies readonly (readonly [string, MessageKey])[];

const ASSETS = [
  ["cash", "Cash"],
  ["gold", "Gold"],
  ["silver", "Silver"],
  ["investments", "Investments"],
  ["businessStock", "Stock"],
  ["receivables", "Owed to you"],
] as const satisfies readonly (readonly [string, MessageKey])[];

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    trailingZeroDisplay: "stripIfInteger",
  }).format(amount);

const untilText = (minutes: number, t: Translate) =>
  minutes < 60
    ? t("in {minutes}m", { minutes })
    : t("in {hours}h {minutes}m", {
        hours: Math.floor(minutes / 60),
        minutes: minutes % 60,
      });

const Card: FC<{ title: string; footer?: string; children: ReactNode }> = ({
  title,
  footer,
  children,
}) => (
  <section className="bg-card border-foreground/8 mb-4 rounded-xl border p-3 text-sm break-inside-avoid">
    <h3 className="mb-2 font-[470]">{title}</h3>
    {children}
    {footer && <p className="text-muted-foreground mt-2 text-xs">{footer}</p>}
  </section>
);

const Row: FC<{ label: ReactNode; value: ReactNode; strong?: boolean }> = ({
  label,
  value,
  strong = false,
}) => (
  <div className={cn("flex items-baseline justify-between gap-3 py-1", strong && "font-[560]")}>
    <span className={cn(!strong && "text-muted-foreground")}>{label}</span>
    <span className="tabular-nums">{value}</span>
  </div>
);

function useNow() {
  const [now, setNow] = useState<number>();
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const PrayerTimesCard: FC<{ data: z.output<typeof prayerTimesOutput> }> = ({ data }) => {
  const now = useNow();
  const t = useT();
  const next = PRAYERS.find(
    ([key]) =>
      now !== undefined &&
      key !== "sunrise" &&
      data.times[key] !== null &&
      Date.parse(data.times[key].iso) > now,
  )?.[0];
  const place = data.timezone.split("/").at(-1)?.replaceAll("_", " ");
  const day = new Date(`${data.date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const school = data.basis.asr.school === "hanafi" ? t("Hanafi") : t("Shafi'i");

  return (
    <Card
      title={`${t("Prayer times")} · ${day}${place ? ` · ${place}` : ""}`}
      footer={`${data.basis.method.name} · ${t("{school} Asr", { school })}`}
    >
      {PRAYERS.map(([key, name]) => {
        const time = data.times[key];
        if (!time) return null;
        const isNext = key === next;
        return (
          <Row
            key={key}
            strong={isNext}
            label={t(name)}
            value={
              isNext && now !== undefined
                ? `${time.time} · ${untilText(Math.round((Date.parse(time.iso) - now) / 60_000), t)}`
                : time.time
            }
          />
        );
      })}
    </Card>
  );
};

const QiblaCard: FC<{ data: z.output<typeof qiblaOutput> }> = ({ data }) => {
  const t = useT();
  return (
    <Card title={t("Qibla")}>
      {data.atTheKaaba ? (
        <p>{t("You are at the Kaaba.")}</p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="border-foreground/15 relative flex size-16 shrink-0 items-center justify-center rounded-full border">
            <span className="text-muted-foreground absolute top-0.5 text-[10px]">N</span>
            <IconNavigation
              className="text-super size-6 fill-current"
              style={{ rotate: `${data.bearingDegrees}deg` }}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-[560] tabular-nums">
              {Math.round(data.bearingDegrees)}° {data.compass}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {t("{km} km to the Kaaba", {
                km: data.distanceToKaabaKm.toLocaleString(),
              })}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};

const ZakatCard: FC<{ data: z.output<typeof zakatOutput> }> = ({ data }) => {
  const t = useT();
  const nisab = data.byBasis[data.selectedBasis];
  const assets = ASSETS.filter(([key]) => data.assets[key] > 0).map(
    ([key, name]) => `${t(name)} ${money(data.assets[key], data.currency)}`,
  );

  return (
    <Card title={t("Zakat")} footer={assets.join(" · ")}>
      <Row label={t("Zakatable wealth")} value={money(data.netZakatableWealth, data.currency)} />
      <Row
        label={t("Nisab ({basis}, {grams} g)", {
          basis: data.selectedBasis,
          grams: nisab.nisabGrams,
        })}
        value={money(nisab.nisabValue, data.currency)}
      />
      <Row
        strong
        label={t("Zakat due ({rate}%)", { rate: data.rate * 100 })}
        value={money(data.zakatDue, data.currency)}
      />
    </Card>
  );
};

const InheritanceCard: FC<{ data: z.output<typeof inheritanceOutput> }> = ({ data }) => {
  const { currency } = data.estate;
  const t = useT();

  return (
    <Card
      title={t("Inheritance · {amount} to share", {
        amount: money(data.estate.distributable, currency),
      })}
      footer={
        data.excluded.length > 0
          ? t("Excluded: {heirs}", {
              heirs: data.excluded.map((heir) => heir.label).join(", "),
            })
          : undefined
      }
    >
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1">
        {data.heirs.map((heir) => (
          <div key={heir.label} className="contents">
            <span className="text-muted-foreground">
              {heir.label}
              {heir.count > 1 && ` ×${heir.count}`}
            </span>
            <span className="text-end tabular-nums">{heir.fraction}</span>
            <span className="text-end tabular-nums">
              {money(heir.amount, currency)}
              {heir.each && (
                <span className="text-muted-foreground block text-xs">
                  {t("{amount} each", {
                    amount: money(heir.each.amount, currency),
                  })}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};

function cardFor(part: Part | undefined) {
  if (part?.type !== "tool-call") return null;
  switch (part.toolName) {
    case "prayerTimes": {
      const data = prayerTimesOutput.safeParse(part.result).data;
      return data ? <PrayerTimesCard data={data} /> : null;
    }
    case "qibla": {
      const data = qiblaOutput.safeParse(part.result).data;
      return data ? <QiblaCard data={data} /> : null;
    }
    case "zakatCalculator": {
      const data = zakatOutput.safeParse(part.result).data;
      return data ? <ZakatCard data={data} /> : null;
    }
    case "inheritance": {
      const data = inheritanceOutput.safeParse(part.result).data;
      return data ? <InheritanceCard data={data} /> : null;
    }
    default:
      return null;
  }
}

export const ToolCards: FC<{ indices: readonly number[] }> = ({ indices }) => {
  const parts = useAuiState((s) => s.message.parts);

  return indices.map((index) => {
    const card = cardFor(parts[index]);
    return card && <div key={index}>{card}</div>;
  });
};
