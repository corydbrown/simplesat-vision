import type { TicketStatus } from "@/db/schema";

const STYLES: Record<TicketStatus, string> = {
  open: "bg-red-50 text-red-700 ring-red-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  solved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  closed: "bg-zinc-100 text-zinc-700 ring-zinc-200",
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
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
