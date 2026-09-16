import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight hover/focus tooltip — no Radix primitive added since this
 * codebase's other UI primitives (dialog.tsx, tabs.tsx) are hand-rolled
 * with plain state rather than pulling in more of @radix-ui/*.
 * Opens on hover AND focus so it's reachable by keyboard, not just mouse.
 */
export function Tooltip({
  content,
  children,
  className,
  align = "center",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  align?: "start" | "center";
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <div
          role="tooltip"
          className={cn(
            "absolute top-full z-50 mt-2 w-72 max-w-[85vw] rounded-lg border border-border bg-popover p-3 text-left text-xs leading-relaxed text-popover-foreground shadow-lg",
            align === "center" ? "left-1/2 -translate-x-1/2" : "left-0",
            className,
          )}
        >
          {content}
        </div>
      )}
    </span>
  );
}
