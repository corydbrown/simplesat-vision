import type { QaEvaluationStatus } from "@/db/schema";
import {
  QA_BUCKET_CLASSES,
  qaScoreBucket,
} from "@/lib/qa/score-color";

type Size = "sm" | "md";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-1.5 py-0.5 text-sm",
  md: "px-2.5 py-1 text-base",
};

/** Pill rendering of a QA overall score (0-100). Bucket + color come from
 *  `qaScoreBucket` so the rule lives in one place — shared with SVP-54's
 *  per-ticket QA section. Renders an em-dash when the ticket has no
 *  evaluation; the bucket helper also routes `invalidated` to that visual. */
export function QaScoreBadge({
  score,
  status = null,
  size = "sm",
}: {
  score: number | null | undefined;
  status?: QaEvaluationStatus | null;
  size?: Size;
}) {
  const bucket = qaScoreBucket(score, status);
  const classes = QA_BUCKET_CLASSES[bucket];

  if (bucket === "not-scored") {
    return <span className="text-muted-foreground/40">—</span>;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium tabular-nums ${SIZE_CLASSES[size]} ${classes.bg} ${classes.text}`}
    >
      {bucket === "auto-failed" ? `${score} · fail` : score}
    </span>
  );
}
