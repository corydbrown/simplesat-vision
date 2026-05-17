export function RelationPill({
  label,
  sublabel,
  color,
}: {
  label: string;
  sublabel?: string;
  color?: string;
}) {
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  return (
    <span className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-accent">
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
        style={{ backgroundColor: color ?? "#71717a" }}
      >
        {initials || "?"}
      </span>
      <span className="truncate">{label}</span>
      {sublabel && (
        <span className="text-[10px] text-muted-foreground">{sublabel}</span>
      )}
    </span>
  );
}
