import type { CustomerTier } from "@/db/schema";

const TIER_TONE: Record<CustomerTier, string> = {
  insider: "bg-grey-lighter text-grey-darker",
  gold: "bg-yellow-lighter text-yellow-darker",
  elite: "bg-purple-lighter text-purple-darker",
};

const TIER_LABEL: Record<CustomerTier, string> = {
  insider: "Insider",
  gold: "Gold",
  elite: "Elite",
};

export function TierPill({ tier }: { tier: CustomerTier }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${TIER_TONE[tier]}`}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}
