import type { QaEvaluationStatus } from "@/db/schema";

type Size = "sm" | "md";

/** The single authoritative color map for the QA evaluation lifecycle.
 *  Semantics drive the hue:
 *   - ai_scored  → blue   (informational — machine-generated, awaiting review)
 *   - edited     → purple (human-modified, distinct from the AI state)
 *   - contested  → yellow (disputed — an attention/problem state)
 *   - invalidated→ red    (void/rejected — a terminal problem state)
 *   - finalized  → green  (confirmed, locked, done)
 *  Production hue tokens only, so the pill theme-flips automatically. */
const STYLES: Record<QaEvaluationStatus, string> = {
  ai_scored: "bg-blue-lighter text-blue-darker",
  edited: "bg-purple-lighter text-purple-darker",
  contested: "bg-yellow-lighter text-yellow-darker",
  invalidated: "bg-red-lighter text-red-darker",
  finalized: "bg-green-lighter text-green-darker",
};

const LABELS: Record<QaEvaluationStatus, string> = {
  ai_scored: "AI scored",
  edited: "Edited",
  contested: "Contested",
  invalidated: "Invalidated",
  finalized: "Finalized",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-1.5 py-0.5 text-sm",
  md: "px-2.5 py-1 text-base",
};

/** Authoritative QA evaluation status pill — the single source of truth for
 *  coloring the `QaEvaluationStatus` enum. Consumed across coaching, ticket
 *  detail, the QA section, and the QA dashboard so the same evaluation reads
 *  identically on every surface. */
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
