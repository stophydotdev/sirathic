"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import type { FC, ReactNode } from "react";

export const tabClass = (active: boolean) =>
  cn(
    "flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors",
    active ? "bg-muted" : "text-muted-foreground hover:text-foreground",
  );

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
