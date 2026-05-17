const TABS = [
  { id: "all", label: "All tickets" },
  { id: "rated", label: "Rated" },
  { id: "unrated", label: "Unrated" },
  { id: "detractors", label: "Detractors" },
  { id: "not-fired", label: "Survey not fired" },
] as const;

export function ViewTabs({ active = "all" }: { active?: string }) {
  return (
    <div className="flex items-center gap-1 border-b border-border px-5">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
            t.id === active
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
