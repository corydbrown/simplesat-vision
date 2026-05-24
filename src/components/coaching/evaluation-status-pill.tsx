import type { QaEvaluationStatus } from "@/db/schema";

const STYLES: Record<QaEvaluationStatus, string> = {
  ai_scored: "bg-blue-lighter text-blue-darker",
  edited: "bg-purple-lighter text-purple-darker",
  contested: "bg-yellow-lighter text-yellow-darker",
  invalidated: "bg-grey-lighter text-grey-darker",
  finalized: "bg-green-lighter text-green-darker",
};

const LABELS: Record<QaEvaluationStatus, string> = {
  ai_scored: "AI scored",
  edited: "Edited",
  contested: "Contested",
  invalidated: "Invalidated",
  finalized: "Finalized",
};

export function EvaluationStatusPill({
  status,
}: {
  status: QaEvaluationStatus;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
