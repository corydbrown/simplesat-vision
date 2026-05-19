import type { CustomerTier } from "@/db/schema";

const TIER_TONE: Record<CustomerTier, string> = {
  insider: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  gold: "bg-amber-50 text-amber-800 ring-amber-200",
  elite: "bg-purple-50 text-purple-700 ring-purple-200",
};

const TIER_LABEL: Record<CustomerTier, string> = {
  insider: "Insider",
  gold: "Gold",
  elite: "Elite",
};

export function TierPill({ tier }: { tier: CustomerTier }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TIER_TONE[tier]}`}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}
