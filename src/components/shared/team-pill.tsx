const TONES: Record<string, string> = {
  "Front line": "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/20",
  Senior: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/20",
  Specialist: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/20",
};

export function TeamPill({ team }: { team: string }) {
  const tone = TONES[team] ?? "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-500/15 dark:text-zinc-300 dark:ring-zinc-500/20";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      {team}
    </span>
  );
}
