"use client";

import { useAccount } from "@/components/account";
import { type Translate, useLocale, useT } from "@/components/i18n";
import { control, DangerRow, Group, Row } from "@/components/settingsControls";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { ComputerIcon, SmartPhone01Icon } from "@hugeicons/core-free-icons";
import { type FC, useEffect, useState } from "react";

type Device = Awaited<ReturnType<typeof api.account.devices.query>>[number];

const PHONES = new Set(["Android", "iOS", "iPadOS"]);

const nameOf = (t: Translate, { device }: Device) => {
  switch (device.kind) {
    case "browser":
      return device.system
        ? t("{browser} on {system}", { browser: device.browser, system: device.system })
        : device.browser;
    case "app":
      return device.system
        ? t("{browser} on {system}", { browser: t("Sirathic app"), system: device.system })
        : t("Sirathic app");
    case "unknown":
      return t("Unknown device");
    default: {
      const unknownDevice: never = device;
      return unknownDevice;
    }
  }
};

const agoOf = (iso: string, locale: string) => {
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  if (minutes > -60) return format.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  return hours > -24 ? format.format(hours, "hour") : format.format(Math.round(hours / 24), "day");
};

export const DevicesGroup: FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [busy, setBusy] = useState(false);
  const locale = useLocale();
  const t = useT();

  useEffect(() => {
    void api.account.devices.query().then(setDevices, () => undefined);
  }, []);

  const signOut = async (done: Promise<unknown>) => {
    setBusy(true);
    await done.catch(() => undefined);
    setDevices(await api.account.devices.query().catch(() => devices));
    setBusy(false);
  };
  const signOutOthers = () => signOut(api.account.signOutOthers.mutate());
  const signOutDevice = (id: string) => signOut(api.account.signOutDevice.mutate({ id }));

  return (
    <Group title={t("Devices")}>
      {devices.map((device) => (
        <div key={device.id} className="flex items-center gap-3 py-2">
          <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
            <HugeiconsIcon
              icon={
                device.device.kind !== "unknown" && PHONES.has(device.device.system ?? "")
                  ? SmartPhone01Icon
                  : ComputerIcon
              }
              className="size-4"
            />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm">{nameOf(t, device)}</span>
            <span className="text-muted-foreground text-[13px]">
              {device.current ? t("Active now") : agoOf(device.lastActive, locale)}
            </span>
          </div>
          {device.current ? (
            <span className="text-super text-[13px]">{t("This device")}</span>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void signOutDevice(device.id)}
              className={cn(control, "disabled:opacity-60")}
            >
              {t("Sign out")}
            </button>
          )}
        </div>
      ))}
      <Row
        label={t("Sign out everywhere else")}
        hint={t("Every other device has to sign in again")}
      >
        <button
          type="button"
          disabled={busy || devices.every((device) => device.current)}
          onClick={() => void signOutOthers()}
          className={cn(control, "disabled:opacity-60")}
        >
          {t("Sign out others")}
        </button>
      </Row>
    </Group>
  );
};

export const DeleteAccountRow: FC = () => {
  const signOut = useAccount((s) => s.signOut);
  const t = useT();

  return (
    <DangerRow
      label={t("Delete account")}
      hint={t("Deletes your chats, memory, bots and files, then signs you out")}
      question={t("Delete your account and everything in it? This can't be undone.")}
      action={t("Delete")}
      onConfirm={async () => {
        await api.account.delete.mutate();
        await signOut();
        window.location.assign("/");
      }}
    />
  );
};
