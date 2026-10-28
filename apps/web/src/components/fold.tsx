import { cn } from "@/lib/utils";
import type { FC, ReactNode } from "react";

export const Fold: FC<{ open: boolean; id?: string; className?: string; children: ReactNode }> = ({
  open,
  id,
  className,
  children,
}) => (
  <div
    id={id}
    inert={!open}
    className="grid transition-all duration-300 ease-out-quint motion-reduce:transition-none"
    style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
  >
    <div className="min-h-0 overflow-hidden">
      <div
        className={cn(
          "flex flex-col transition-transform duration-300 ease-out-quint motion-reduce:transition-none",
          !open && "-translate-y-2",
          className,
        )}
      >
        {children}
      </div>
    </div>
  </div>
);
