import { Star } from "lucide-react";

export function AvgRating({
  value,
  threshold = "customer",
  size = "sm",
}: {
  value: number | null;
  threshold?: "customer" | "team-member";
  size?: "sm" | "md";
}) {
  if (value == null) return <span className="text-muted-foreground">-</span>;

  const tone = ratingTone(value, threshold);

  return (
    <span
      className={`inline-flex items-center gap-1 ${
        size === "md" ? "text-base" : "text-sm"
      } ${tone ?? ""}`}
    >
      <Star size={size === "md" ? 14 : 11} className="fill-current" />
      <span className="tabular-nums font-medium">{value.toFixed(2)}</span>
    </span>
  );
}

export function ratingTone(
  value: number | null,
  threshold: "customer" | "team-member" = "customer",
): string | undefined {
  if (value == null) return undefined;
  // Customer threshold: <3 red, <4 yellow, else green.
  // Team-member bar is higher (<3.5 red, <4 yellow, else green).
  const dangerCutoff = threshold === "team-member" ? 3.5 : 3;
  return value < dangerCutoff
    ? "text-red-dark"
    : value < 4
      ? "text-yellow-dark"
      : "text-green-dark";
}
