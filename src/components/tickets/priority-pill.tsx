import type { TicketPriority } from "@/db/schema";

const STYLES: Record<TicketPriority, string> = {
  low: "bg-grey-lighter text-grey-darker",
  normal: "bg-blue-lighter text-blue-darker",
  high: "bg-yellow-lighter text-yellow-darker",
  urgent: "bg-red-lighter text-red-darker",
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
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${STYLES[priority]}`}
    >
      {LABELS[priority]}
    </span>
  );
}
