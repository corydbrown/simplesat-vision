const TONES: Record<string, string> = {
  "Front line": "bg-blue-lighter text-blue-darker",
  Senior: "bg-purple-lighter text-purple-darker",
  Specialist: "bg-green-lighter text-green-darker",
};

const FALLBACK = "bg-grey-lighter text-grey-darker";

export function TeamPill({ team }: { team: string }) {
  const tone = TONES[team] ?? FALLBACK;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${tone}`}
    >
      {team}
    </span>
  );
}
