"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { type FC, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

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

export const TabBar: FC<{ className?: string; children: ReactNode }> = ({
  className,
  children,
}) => {
  const bar = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);

  useEffect(() => {
    let scroller = bar.current?.parentElement;
    while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    if (!scroller) return;
    const page = scroller;
    let last = page.scrollTop;
    const onScroll = () => {
      const top = page.scrollTop;
      if (Math.abs(top - last) < 6) return;
      setAway(top > last && top > 120);
      last = top;
    };
    page.addEventListener("scroll", onScroll, { passive: true });
    return () => page.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      ref={bar}
      className={cn(
        "bg-background sticky top-14 z-20 -mt-3 mb-3 py-3 transition-transform duration-300 ease-out-quint motion-reduce:transition-none lg:top-0",
        away && "-translate-y-24",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const useTabSlide = <Tab extends string>(tabs: readonly Tab[], tab: Tab) => {
  const [seen, setSeen] = useState({ tab, slide: "" });
  if (seen.tab !== tab) {
    const forward = tabs.indexOf(tab) > tabs.indexOf(seen.tab);
    setSeen({
      tab,
      slide: cn(
        "animate-in duration-300 ease-out-quint motion-reduce:animate-none",
        forward ? "slide-in-from-end-8" : "slide-in-from-start-8",
      ),
    });
  }
  return seen.tab === tab ? seen.slide : "";
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
