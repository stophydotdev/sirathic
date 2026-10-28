import type { ThreadMessage } from "@assistant-ui/react";
import type { FC, ReactNode } from "react";

export type ToolCall = Extract<ThreadMessage["content"][number], { type: "tool-call" }>;

export const nameOf = (tool: string) => tool.replaceAll(/[_-]+/gu, " ");

const pill = "h-11 rounded-full px-5 text-sm font-medium disabled:opacity-50";

export const primaryPill = `${pill} bg-foreground text-background`;

export const dangerPill = `${pill} bg-destructive text-background`;

export const quietPill = `${pill} bg-foreground/8 hover:bg-foreground/12`;

export const fieldClass =
  "bg-foreground/6 focus-visible:bg-foreground/10 aria-invalid:text-destructive min-w-0 flex-1 rounded-xl px-2.5 py-1.5 text-sm outline-none";

export const Row: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div className="flex items-start gap-3 px-3.5 py-2.5 text-sm">
    <span className="text-muted-foreground w-16 shrink-0 py-1.5 wrap-break-word">{label}</span>
    {children}
  </div>
);

export const CardShell: FC<{
  title: string;
  status: string;
  actions?: ReactNode;
  children: ReactNode;
}> = ({ title, status, actions, children }) => (
  <section
    aria-label={title}
    className="border-foreground/10 bg-foreground/6 my-3 flex w-full max-w-lg flex-col gap-2.5 rounded-3xl border px-2.5 pt-3.5 pb-2.5 print:hidden"
  >
    <div className="flex items-baseline justify-between gap-2 px-1">
      <span className="text-base font-semibold first-letter:uppercase">{title}</span>
      <span className="text-muted-foreground shrink-0 text-xs">{status}</span>
    </div>
    <div className="bg-background border-foreground/8 divide-foreground/8 divide-y overflow-hidden rounded-2xl border">
      {children}
    </div>
    {actions && <div className="flex flex-wrap gap-2 px-1 pb-1">{actions}</div>}
  </section>
);
