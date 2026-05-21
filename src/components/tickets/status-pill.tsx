import type { TicketStatus } from "@/db/schema";

const STYLES: Record<TicketStatus, string> = {
  open: "bg-red-lighter text-red-darker",
  pending: "bg-yellow-lighter text-yellow-darker",
  solved: "bg-green-lighter text-green-darker",
  closed: "bg-grey-lighter text-grey-darker",
};

const LABELS: Record<TicketStatus, string> = {
  open: "Open",
  pending: "Pending",
  solved: "Solved",
  closed: "Closed",
};

export function StatusPill({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
