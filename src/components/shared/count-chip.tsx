import { cn } from "@/lib/utils";

/**
 * Small inline chrome chip used for tight counts (e.g. tab row counts,
 * toolbar filter counts) and short categorical tags (e.g. survey-type
 * tags inside a SurveyPill). Pairs with a parent element that supplies
 * its own surrounding interactive treatment — CountChip is decorative
 * and does not own click/hover state.
 *
 * Uses `text-xs` intentionally: count chips are tight chrome (kbd-adjacent),
 * one of the documented exceptions to the body-size rule in CLAUDE.md.
 *
 * The `active` variant flips the chip from muted to foreground tones for
 * use inside a parent that is itself in an active/selected state (see
 * RelationTabs).
 */
export function CountChip({
  children,
  active = false,
  className,
}: {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-medium tabular-nums",
        active
          ? "bg-foreground/10 text-foreground"
          : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
