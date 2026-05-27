import type { TicketStatus } from "@/db/schema";

// Status is now source-verbatim free text (see schema). The seed uses the
// original four values; ingest will bring source-native vocabularies
// (Zendesk: new/open/pending/hold/solved/closed; Intercom:
// open/closed/snoozed). Known statuses get intentional styling; anything else
// degrades to a neutral pill with a humanized label rather than rendering
// `undefined`. Add a mapping when a new status earns a distinct color.
const STYLES: Record<string, string> = {
  new: "bg-red-lighter text-red-darker",
  open: "bg-red-lighter text-red-darker",
  pending: "bg-yellow-lighter text-yellow-darker",
  hold: "bg-yellow-lighter text-yellow-darker",
  snoozed: "bg-yellow-lighter text-yellow-darker",
  solved: "bg-green-lighter text-green-darker",
  closed: "bg-grey-lighter text-grey-darker",
};

const LABELS: Record<string, string> = {
  new: "New",
  open: "Open",
  pending: "Pending",
  hold: "Hold",
  snoozed: "Snoozed",
  solved: "Solved",
  closed: "Closed",
};

const NEUTRAL = "bg-grey-lighter text-grey-darker";

/** Humanize an unmapped raw status: "in_progress" → "In progress". */
function humanize(status: string): string {
  const spaced = status.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function StatusPill({ status }: { status: TicketStatus }) {
  const className = STYLES[status] ?? NEUTRAL;
  const label = LABELS[status] ?? humanize(status);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${className}`}
    >
      {label}
    </span>
  );
}
