import type { QaEvaluationStatus } from "@/db/schema";

type Size = "sm" | "md";

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

// Mirror `QaScoreBadge` so the two pills are interchangeable side-by-side.
const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-1.5 py-0.5 text-sm",
  md: "px-2.5 py-1 text-base",
};

export function EvaluationStatusPill({
  status,
  size = "sm",
}: {
  status: QaEvaluationStatus;
  size?: Size;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${SIZE_CLASSES[size]} ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
