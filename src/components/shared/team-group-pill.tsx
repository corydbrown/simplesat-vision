const TONES: Record<string, string> = {
  "Customer Care": "bg-blue-lighter text-blue-darker",
  "Returns & Exchanges": "bg-yellow-lighter text-yellow-darker",
  "Online Orders": "bg-teal-lighter text-teal-darker",
  "Stores & BOPIS": "bg-green-lighter text-green-darker",
  "Loyalty & VIP": "bg-purple-lighter text-purple-darker",
  Escalations: "bg-red-lighter text-red-darker",
};

const FALLBACK = "bg-grey-lighter text-grey-darker";

export function TeamGroupPill({ name }: { name: string }) {
  const tone = TONES[name] ?? FALLBACK;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${tone}`}
    >
      {name}
    </span>
  );
}
