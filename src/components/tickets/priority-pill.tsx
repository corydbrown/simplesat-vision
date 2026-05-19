import type { TicketPriority } from "@/db/schema";

const STYLES: Record<TicketPriority, string> = {
  low: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  normal: "bg-blue-50 text-blue-700 ring-blue-200",
  high: "bg-amber-50 text-amber-800 ring-amber-200",
  urgent: "bg-red-50 text-red-700 ring-red-200",
};

const LABELS: Record<TicketPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export function PriorityPill({ priority }: { priority: TicketPriority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[priority]}`}
    >
      {LABELS[priority]}
    </span>
  );
}
