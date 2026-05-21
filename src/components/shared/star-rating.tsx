import { Star } from "lucide-react";

export function StarRating({
  value,
  scale,
  size = "md",
}: {
  value: number;
  scale: number;
  size?: "sm" | "md";
}) {
  const stars = Array.from({ length: scale }, (_, i) => i + 1);
  const starSize = size === "md" ? 18 : 14;
  return (
    <div className="inline-flex items-center gap-0.5">
      {stars.map((n) => (
        <Star
          key={n}
          size={starSize}
          className={
            n <= value
              ? "fill-yellow text-yellow"
              : "fill-grey-light text-grey-light"
          }
        />
      ))}
      <span className="ml-2 text-sm tabular-nums text-muted-foreground">
        {value}/{scale}
      </span>
    </div>
  );
}
