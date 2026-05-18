import type { CustomerTier } from "@/db/schema";

const TIER_TONE: Record<CustomerTier, string> = {
  starter: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  pro: "bg-blue-50 text-blue-700 ring-blue-200",
  enterprise: "bg-purple-50 text-purple-700 ring-purple-200",
};

const TIER_LABEL: Record<CustomerTier, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
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
