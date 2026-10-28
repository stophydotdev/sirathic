import type { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";

const FACE =
  "col-start-1 row-start-1 flex items-center justify-center transition duration-250 ease-in-out motion-reduce:transition-none";
const GONE = "scale-25 opacity-0 blur-xs";

export const Swap: FC<{ swapped: boolean; from: ReactNode; to: ReactNode }> = ({
  swapped,
  from,
  to,
}) => (
  <span className="inline-grid">
    <span inert={swapped} className={cn(FACE, swapped && GONE)}>
      {from}
    </span>
    <span inert={!swapped} className={cn(FACE, !swapped && GONE)}>
      {to}
    </span>
  </span>
);
