"use client";

import { useChatState } from "@/components/chat";
import { useLocale, useT } from "@/components/i18n";
import { ProductDialog } from "@/components/productDialog";
import { faviconUrl } from "@/components/sources";
import { shownProducts } from "@sirathic/server/cards";
import { useAuiState } from "@assistant-ui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, StarIcon } from "@hugeicons/core-free-icons";
import { type FC, useEffect, useRef, useState } from "react";

const arrow =
  "bg-background/90 text-foreground absolute top-1/3 flex size-9 items-center justify-center rounded-full shadow-md backdrop-blur";

export const ProductsCard: FC<{ result: unknown }> = ({ result }) => {
  const shown = shownProducts.safeParse(result).data;
  const t = useT();
  const locale = useLocale();
  const row = useRef<HTMLDivElement>(null);
  const [ends, setEnds] = useState({ back: false, next: false });
  const [opened, setOpened] = useState<string>();
  const chat = useChatState()?.chat;
  const offered = useAuiState(
    (s) => !s.thread.isRunning && s.thread.messages.at(-1)?.id === s.message.id,
  );

  const measure = () => {
    const element = row.current;
    if (!element) return;
    const scrolled = Math.abs(element.scrollLeft);
    setEnds({
      back: scrolled > 1,
      next: scrolled + element.clientWidth < element.scrollWidth - 1,
    });
  };
  useEffect(measure, [shown?.products.length]);

  if (!shown) return null;
  const most =
    shown.products.length > 1
      ? shown.products.reduce<(typeof shown.products)[number] | undefined>(
          (best, item) => ((item.reviews ?? 0) > (best?.reviews ?? 0) ? item : best),
          undefined,
        )?.id
      : undefined;
  const page = (direction: 1 | -1) => {
    const element = row.current;
    if (!element) return;
    const flip = getComputedStyle(element).direction === "rtl" ? -1 : 1;
    element.scrollBy({ left: direction * flip * element.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="my-3 w-full print:hidden">
      <div className="relative">
        <div ref={row} onScroll={measure} className="flex snap-x gap-3 overflow-x-auto pb-2">
          {shown.products.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setOpened(item.id)}
              className="border-foreground/10 bg-card hover:border-foreground/25 flex w-56 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border text-start"
            >
              <span className="relative block aspect-square bg-white">
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 size-full object-cover"
                  />
                )}
                {item.id === most && (
                  <span className="absolute start-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                    {t("Most reviewed")}
                  </span>
                )}
              </span>
              <span className="flex flex-1 flex-col gap-1 p-3">
                <span className="truncate text-sm font-medium">{item.title}</span>
                {item.rating !== undefined && (
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    <HugeiconsIcon icon={StarIcon} className="size-3" />
                    {item.rating}
                    {item.reviews !== undefined &&
                      ` (${new Intl.NumberFormat(locale).format(item.reviews)})`}
                  </span>
                )}
                <span className="text-muted-foreground line-clamp-2 text-xs">
                  <span className="text-foreground">
                    {new Intl.NumberFormat(locale, {
                      style: "currency",
                      currency: item.currency,
                    }).format(item.price)}
                  </span>
                  {` · ${item.note}`}
                </span>
                <span className="text-muted-foreground mt-auto flex min-w-0 items-center gap-1.5 pt-1 text-xs">
                  <img
                    src={faviconUrl(item.storeUrl ?? item.url)}
                    alt=""
                    loading="lazy"
                    className="size-4 shrink-0 rounded-sm"
                  />
                  <span className="truncate">{item.store}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
        {ends.back && (
          <button
            type="button"
            aria-label={t("Back")}
            onClick={() => page(-1)}
            className={`${arrow} start-2`}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4 rtl:rotate-180" />
          </button>
        )}
        {ends.next && (
          <button
            type="button"
            aria-label={t("Next")}
            onClick={() => page(1)}
            className={`${arrow} end-2`}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 rtl:rotate-180" />
          </button>
        )}
      </div>
      {shown.products.map((item) => (
        <ProductDialog
          key={item.id}
          item={item}
          open={opened === item.id}
          onOpenChange={(open) => setOpened(open ? item.id : undefined)}
        />
      ))}
      {offered && shown.followUps && shown.followUps.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {shown.followUps.map((ask) => (
            <button
              key={ask}
              type="button"
              onClick={() =>
                void chat?.sendMessage({ text: ask, metadata: { createdAt: Date.now() } })
              }
              className="bg-foreground/7 hover:bg-foreground/12 h-9 rounded-full px-3.5 text-sm"
            >
              {ask}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
