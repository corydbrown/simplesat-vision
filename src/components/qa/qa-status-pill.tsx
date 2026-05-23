import type { QaEvaluationStatus } from "@/db/schema";

const QA_STATUS_LABEL: Record<QaEvaluationStatus, string> = {
  ai_scored: "AI scored",
  edited: "Edited",
  contested: "Contested",
  invalidated: "Invalidated",
  finalized: "Finalized",
};

const QA_STATUS_CLASSES: Record<QaEvaluationStatus, string> = {
  ai_scored: "bg-grey-lighter text-grey-darker",
  edited: "bg-blue-lighter text-blue-darker",
  contested: "bg-yellow-lighter text-yellow-darker",
  invalidated: "bg-red-lighter text-red-darker",
  finalized: "bg-green-lighter text-green-darker",
};

/** Shared QA evaluation status pill. Consumed by both the compact drawer
 *  breakdown (SVP-55's QaBreakdownSection in `ticket-detail.tsx`) and the
 *  standalone full QA section (SVP-54's `TicketQaSection`). Status colors
 *  match the production hue palette and theme-flip automatically. */
export function QaStatusPill({ status }: { status: QaEvaluationStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${QA_STATUS_CLASSES[status]}`}
    >
      {QA_STATUS_LABEL[status]}
    </span>
  );
}
