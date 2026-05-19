const TONES: Record<string, string> = {
  "Front line": "bg-blue-50 text-blue-700 ring-blue-200",
  Senior: "bg-violet-50 text-violet-700 ring-violet-200",
  Specialist: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function TeamPill({ team }: { team: string }) {
  const tone = TONES[team] ?? "bg-zinc-100 text-zinc-700 ring-zinc-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      {team}
    </span>
  );
}
