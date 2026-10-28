"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { type FC, type ReactNode, useLayoutEffect, useRef } from "react";

export const tabClass = (active: boolean) =>
  cn(
    "relative flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors",
    !active && "text-muted-foreground hover:text-foreground",
  );

type Spot = { left: number; top: number; width: number; height: number };

const lastSpots = new Map<string, Spot>();

const spotOf = (element: HTMLElement): Spot => ({
  left: element.offsetLeft,
  top: element.offsetTop,
  width: element.offsetWidth,
  height: element.offsetHeight,
});

export const TabPill: FC<{ className?: string; name?: string }> = ({ className, name }) => {
  const pill = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const node = pill.current;
    const list = node?.parentElement;
    if (!node || !list) return;
    let current: HTMLElement | undefined;
    let pending: HTMLElement | undefined;
    let shown: Spot | undefined;
    let first = true;
    const show = (spot: Spot, slide: boolean) => {
      const same =
        shown?.left === spot.left &&
        shown.top === spot.top &&
        shown.width === spot.width &&
        shown.height === spot.height;
      if (same) return;
      shown = spot;
      if (!slide) node.style.transition = "none";
      node.style.left = `${spot.left}px`;
      node.style.top = `${spot.top}px`;
      node.style.width = `${spot.width}px`;
      node.style.height = `${spot.height}px`;
      if (!slide) {
        node.getBoundingClientRect();
        node.style.transition = "";
      }
    };
    const sizes = new ResizeObserver(() => update());
    const update = () => {
      const active = list.querySelector<HTMLElement>('[aria-selected="true"], [data-active]');
      for (const child of list.children) sizes.observe(child);
      if (pending?.isConnected && active !== pending) return;
      pending = undefined;
      if (!active || active.closest("[inert]")) {
        node.hidden = true;
        current = undefined;
        return;
      }
      node.hidden = false;
      sizes.observe(active);
      const last = first && name ? lastSpots.get(name) : undefined;
      if (last) show(last, false);
      show(spotOf(active), last !== undefined || (current !== undefined && current !== active));
      current = active;
      first = false;
    };
    update();
    const changes = new MutationObserver(update);
    changes.observe(list, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-selected", "data-active", "inert"],
    });
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      const tab =
        target?.closest("[role=tab]") ??
        (target?.closest("a[href]") ? target.closest("[data-row]") : null);
      if (!(tab instanceof HTMLElement) || !list.contains(tab) || tab === current) return;
      show(spotOf(tab), true);
      current = tab;
      pending = tab;
    };
    list.addEventListener("click", onClick);
    return () => {
      sizes.disconnect();
      changes.disconnect();
      list.removeEventListener("click", onClick);
      if (!name) return;
      const now = getComputedStyle(node);
      lastSpots.set(name, {
        left: parseFloat(now.left),
        top: parseFloat(now.top),
        width: parseFloat(now.width),
        height: parseFloat(now.height),
      });
    };
  }, [name]);

  return (
    <span
      ref={pill}
      aria-hidden
      className={cn(
        "bg-muted pointer-events-none absolute rounded-full transition-all duration-300 ease-out-quint motion-reduce:transition-none",
        className,
      )}
    />
  );
};

export const TabLink: FC<{ href: string; active: boolean; children: ReactNode }> = ({
  href,
  active,
  children,
}) => (
  <Link
    href={href}
    replace
    scroll={false}
    role="tab"
    aria-selected={active}
    className={tabClass(active)}
  >
    {children}
  </Link>
);
