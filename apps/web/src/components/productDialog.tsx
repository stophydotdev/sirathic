"use client";

import { useBot } from "@/components/botHome";
import { useChatState } from "@/components/chat";
import { useLocale, useT } from "@/components/i18n";
import { faviconUrl } from "@/components/sources";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { shownProducts } from "@sirathic/server/cards";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, StarIcon } from "@hugeicons/core-free-icons";
import { Dialog } from "radix-ui";
import { type FC, useEffect, useState } from "react";
import type { z } from "zod";

type Shown = z.infer<typeof shownProducts>["products"][number];
type Detail = Awaited<ReturnType<typeof api.shop.product.query>>;
type Choice = Detail["selected"];

const money = (locale: string, amount: number, currency: string) =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);

export const ProductDialog: FC<{
  item: Shown;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ item, open, onOpenChange }) => {
  const t = useT();
  const locale = useLocale();
  const chat = useChatState()?.chat;
  const bot = useBot();
  const [detail, setDetail] = useState<Detail>();
  const [choice, setChoice] = useState<Choice>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let current = true;
    setLoading(true);
    api.shop.product
      .query({ id: item.id, selected: choice, country: item.country })
      .then(
        (found) => current && setDetail(found),
        () => undefined,
      )
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [open, item.id, item.country, choice]);

  const shown = detail ?? item;
  const picked = detail?.selected ?? [];
  const pick = (name: string, label: string) =>
    setChoice([...picked.filter((option) => option.name !== name), { name, label }]);
  const buy = () => {
    if (!detail?.checkoutUrl) return;
    if (bot) {
      void chat?.sendMessage({
        text: `${t("Buy this for {price}", { price: money(locale, detail.price, detail.currency) })}\n${detail.checkoutUrl}`,
        metadata: { createdAt: Date.now() },
      });
    } else {
      window.open(detail.checkoutUrl, "_blank", "noopener,noreferrer");
    }
    onOpenChange(false);
  };
  const specs = (detail?.specs ?? []).map((spec) => {
    const at = spec.indexOf(": ");
    return at > 0 ? [spec.slice(0, at), spec.slice(at + 2)] : [spec, ""];
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dim fixed inset-0 z-60 bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="pop bg-background ring-foreground/7 fixed inset-4 z-60 m-auto flex max-h-160 max-w-4xl flex-col overflow-hidden rounded-3xl shadow-lg ring-1 outline-none ring-inset"
        >
          <div className="border-foreground/7 flex items-center gap-3 border-b px-5 py-3.5">
            <Dialog.Title className="min-w-0 flex-1 truncate text-sm font-medium">
              {shown.title}
            </Dialog.Title>
            <Dialog.Close
              aria-label={t("Close")}
              className="text-muted-foreground hover:bg-foreground/8 hover:text-foreground -me-1.5 flex size-8 items-center justify-center rounded-full"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
            </Dialog.Close>
          </div>
          <div className="grid gap-6 overflow-y-auto p-5 md:grid-cols-2">
            {shown.imageUrl ? (
              <img
                src={shown.imageUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="aspect-square w-full rounded-2xl bg-white object-contain"
              />
            ) : (
              <span className="aspect-square w-full rounded-2xl bg-white" />
            )}
            <div className={cn("flex flex-col gap-3", loading && "opacity-70")}>
              <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <img
                  src={faviconUrl(shown.storeUrl ?? shown.url)}
                  alt=""
                  className="size-4 rounded-sm"
                />
                {shown.store}
              </p>
              <p className="text-lg leading-snug font-medium">{shown.title}</p>
              <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
                <span className="text-foreground">
                  {money(locale, shown.price, shown.currency)}
                </span>
                {shown.listPrice !== undefined && shown.listPrice > shown.price && (
                  <span className="line-through">
                    {money(locale, shown.listPrice, shown.currency)}
                  </span>
                )}
                {shown.rating !== undefined && (
                  <span className="flex items-center gap-1">
                    <HugeiconsIcon icon={StarIcon} className="size-3.5" />
                    {shown.rating}
                    {shown.reviews !== undefined &&
                      ` (${new Intl.NumberFormat(locale).format(shown.reviews)})`}
                  </span>
                )}
              </p>
              {detail?.options.map((option) => (
                <div key={option.name} className="flex flex-col gap-1.5">
                  <p className="text-muted-foreground text-xs">{option.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {option.values.map((value) => {
                      const on = picked.some(
                        (chosen) => chosen.name === option.name && chosen.label === value.label,
                      );
                      return (
                        <button
                          key={value.label}
                          type="button"
                          aria-pressed={on}
                          disabled={value.exists === false || loading}
                          onClick={() => pick(option.name, value.label)}
                          className={cn(
                            "h-8 rounded-lg border px-3 text-xs disabled:opacity-40",
                            on
                              ? "border-foreground bg-foreground/8"
                              : "border-foreground/15 hover:bg-foreground/6",
                            value.available === false && "text-muted-foreground line-through",
                          )}
                        >
                          {value.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={buy}
                disabled={!detail?.checkoutUrl || !detail.available || loading}
                className="bg-foreground text-background mt-1 h-10 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {t("Buy now")}
              </button>
              <a
                href={shown.url}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground text-center text-sm"
              >
                {t("View at {store}", { store: shown.store })}
              </a>
              <p className="border-foreground/7 flex justify-between gap-3 border-t pt-3 text-sm">
                <span className="text-muted-foreground">{t("Sold by")}</span>
                <span className="truncate">{shown.store}</span>
              </p>
            </div>
            {detail?.description && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">{t("About")}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {detail.description}
                </p>
              </div>
            )}
            {specs.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">{t("Details")}</p>
                <div className="divide-foreground/7 flex flex-col divide-y text-sm">
                  {specs.map(([name, value]) => (
                    <p key={name} className="flex justify-between gap-4 py-2">
                      <span className="text-muted-foreground">{name}</span>
                      <span className="text-end">{value}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
