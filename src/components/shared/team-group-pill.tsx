const TONES: Record<string, string> = {
  "Customer Care": "bg-blue-50 text-blue-700 ring-blue-200",
  "Returns & Exchanges": "bg-amber-50 text-amber-800 ring-amber-200",
  "Online Orders": "bg-cyan-50 text-cyan-700 ring-cyan-200",
  "Stores & BOPIS": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Loyalty & VIP": "bg-purple-50 text-purple-700 ring-purple-200",
  Escalations: "bg-red-50 text-red-700 ring-red-200",
};

export function TeamGroupPill({ name }: { name: string }) {
  const tone = TONES[name] ?? "bg-zinc-100 text-zinc-700 ring-zinc-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      {name}
    </span>
  );
}
