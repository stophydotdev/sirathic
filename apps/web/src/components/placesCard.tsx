"use client";

import { useT } from "@/components/i18n";
import { shownPlaces } from "@sirathic/server/cards";
import { HugeiconsIcon } from "@hugeicons/react";
import { Location01Icon, StarIcon } from "@hugeicons/core-free-icons";
import type { FC } from "react";

export const PlacesCard: FC<{ result: unknown }> = ({ result }) => {
  const shown = shownPlaces.safeParse(result).data;
  const t = useT();
  if (!shown) return null;

  return (
    <div className="bg-foreground/7 divide-foreground/10 my-4 flex flex-col divide-y rounded-3xl px-4 print:hidden">
      {shown.places.map((place) => (
        <div key={place.placeId} className="flex gap-3 py-4">
          {place.thumbnailUrl ? (
            <img
              src={place.thumbnailUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="bg-foreground/8 size-16 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span className="bg-foreground/8 text-muted-foreground inline-flex size-16 shrink-0 items-center justify-center rounded-xl">
              <HugeiconsIcon icon={Location01Icon} className="size-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <a
              href={place.placeUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium hover:underline"
            >
              {place.name}
            </a>
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
              {place.rating !== undefined && (
                <span className="inline-flex items-center gap-1">
                  <HugeiconsIcon icon={StarIcon} className="size-3.5" />
                  {place.rating}
                  {place.reviews !== undefined && ` (${place.reviews})`}
                </span>
              )}
              {place.openStatus && <span>{place.openStatus}</span>}
            </p>
            {place.address && <p className="text-muted-foreground text-sm">{place.address}</p>}
            {place.description && <p className="mt-1.5 leading-relaxed">{place.description}</p>}
            {place.tips && place.tips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {place.tips.map((tip) => (
                  <span key={tip} className="bg-foreground/8 rounded-full px-2.5 py-0.5 text-sm">
                    {tip}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      <p className="text-muted-foreground py-2 text-xs">{t("Places from Google Maps")}</p>
    </div>
  );
};
