import { cn } from "@/lib/utils";

/**
 * Shared group-heading label for pickers, dropdowns, and rails.
 *
 * Body-size with muted color: per CLAUDE.md "de-emphasis is via muted color,
 * not smaller size" — the prior copy-pasted `text-xs font-medium
 * text-muted-foreground/80` shape was an off-ladder violation.
 *
 * Default padding (`px-2 py-1`) matches the dominant picker shape; override
 * via `className` for tighter rails (`pt-1` only, `px-2` only, etc.).
 */
export function GroupHeading({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-2 py-1 font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
