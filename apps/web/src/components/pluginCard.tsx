"use client";

import { EventLine } from "@/components/botEvents";
import { Favicon } from "@/components/favicon";
import { useT } from "@/components/i18n";
import { catalogIcon, rootDomain } from "@/components/mentionIcon";
import { api } from "@/lib/trpc";
import { CONNECTORS, connectorId } from "@sirathic/server/catalog";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon, Plug01Icon } from "@hugeicons/core-free-icons";
import { type FC, useEffect, useState } from "react";
import { z } from "zod";

const installed = z.discriminatedUnion("status", [
  z.object({ status: z.literal("connected"), id: connectorId, name: z.string() }),
  z.object({ status: z.literal("redirect"), id: connectorId, name: z.string(), url: z.url() }),
]);

const useConnectedOnReturn = (id: z.infer<typeof connectorId>, waiting: boolean) => {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const check = () =>
      void api.connectors.list
        .query()
        .then((plugins) => {
          if (plugins.some((plugin) => plugin.id === id && plugin.connected)) setConnected(true);
        })
        .catch(() => undefined);
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [id, waiting]);
  return connected;
};

const Connected: FC<{ name: string }> = ({ name }) => {
  const t = useT();
  return <EventLine icon={Plug01Icon} label={t("Connected")} name={name} href="/plugins" />;
};

const ConnectCard: FC<{ id: z.infer<typeof connectorId>; name: string; url: string }> = ({
  id,
  name,
  url,
}) => {
  const t = useT();
  const [waiting, setWaiting] = useState(false);
  const connected = useConnectedOnReturn(id, waiting);
  const connector = CONNECTORS[id];
  if (connected) return <Connected name={name} />;
  return (
    <div className="bot-card flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="bg-background grid size-10 shrink-0 place-items-center rounded-xl">
          <Favicon
            url={`https://${rootDomain(connector.url)}`}
            src={catalogIcon(connector.url)}
            size={28}
            className="rounded-lg bg-transparent"
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className="text-muted-foreground line-clamp-2 text-sm">
            {t(connector.description)}
          </span>
        </span>
        {!waiting && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={() => setWaiting(true)}
            className="border-foreground/15 hover:bg-foreground/8 flex h-8 shrink-0 items-center rounded-full border px-3 text-sm font-medium"
          >
            {t("Authorize")}
          </a>
        )}
      </div>
      {waiting && (
        <p role="status" className="text-muted-foreground flex items-center gap-2 text-sm">
          <HugeiconsIcon icon={Loading03Icon} className="size-4 motion-safe:animate-spin" />
          {t("Waiting for {name} authorization…", { name })}
        </p>
      )}
    </div>
  );
};

export const PluginCard: FC<{ result: unknown }> = ({ result }) => {
  const plugin = installed.safeParse(result).data;
  if (!plugin) return null;
  if (plugin.status === "connected") return <Connected name={plugin.name} />;
  return <ConnectCard id={plugin.id} name={plugin.name} url={plugin.url} />;
};
