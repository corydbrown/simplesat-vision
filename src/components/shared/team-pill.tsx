export function TeamPill({ team }: { team: string }) {
  const tone =
    team === "Tier 1"
      ? "bg-blue-50 text-blue-700 ring-blue-200"
      : "bg-violet-50 text-violet-700 ring-violet-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      {team}
    </span>
  );
}
