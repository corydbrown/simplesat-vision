import { Check } from "lucide-react";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { RESPONSE_PROPERTIES } from "@/lib/properties/responses";
import { PropertiesPanel } from "@/components/shared/properties-panel";
import {
  DetailSection,
  PropertiesHeader,
} from "@/components/shared/detail-section";
import { StarRating } from "@/components/shared/star-rating";
import type { ResponseDetail } from "@/db/queries/responses";
import type { ResponseListRow } from "@/db/queries/responses";
import { formatDateTime } from "@/lib/format";
import type { SurveyAnswer } from "@/db/schema";

function AnswerBlock({ answer }: { answer: SurveyAnswer }) {
  return (
    <div className="rounded-md border border-border bg-background px-4 py-3">
      <div className="text-xs text-muted-foreground">{answer.question}</div>
      <div className="mt-2">
        {answer.type === "rating" && (
          <StarRating value={answer.value} scale={answer.scale} />
        )}
        {answer.type === "multi-choice" && (
          <div className="flex flex-wrap gap-1.5">
            {answer.options.map((opt) => {
              const active = opt === answer.value;
              return (
                <span
                  key={opt}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${
                    active
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 font-medium"
                      : "bg-muted text-muted-foreground ring-transparent"
                  }`}
                >
                  {active && <Check size={11} />}
                  {opt}
                </span>
              );
            })}
          </div>
        )}
        {answer.type === "multi-select" && (
          <div className="flex flex-wrap gap-1.5">
            {answer.value.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                Nothing selected
              </span>
            ) : (
              answer.value.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200"
                >
                  <Check size={11} />
                  {v}
                </span>
              ))
            )}
            {answer.value.length > 0 && (
              <span className="text-xs text-muted-foreground self-center">
                of {answer.options.length} options
              </span>
            )}
          </div>
        )}
        {answer.type === "comment" && (
          <blockquote className="border-l-2 border-border pl-3 text-sm text-foreground/80">
            &ldquo;{answer.value}&rdquo;
          </blockquote>
        )}
      </div>
    </div>
  );
}

export function ResponseDetailBody({
  response,
  responseRow,
}: {
  response: ResponseDetail;
  responseRow: ResponseListRow;
}) {
  const tone =
    response.rating <= 2
      ? "text-red-600"
      : response.rating === 3
        ? "text-amber-600"
        : "text-emerald-600";

  return (
    <main className="px-8 py-6">
      <div className="mb-1 font-mono text-xs text-muted-foreground">
        {response.id}
      </div>
      <div className="flex items-baseline gap-3">
        <h1 className={`text-2xl font-semibold tracking-tight ${tone}`}>
          {response.rating}/{response.scale}
        </h1>
        <span className="text-sm text-muted-foreground capitalize">
          {response.surveyType} response
        </span>
        <span className="text-muted-foreground/60">·</span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatDateTime(response.respondedAt)}
        </span>
      </div>

      <ColumnStateProvider
        tableId="response-detail"
        properties={RESPONSE_PROPERTIES}
      >
        <DetailSection
          title="Properties"
          trailing={<PropertiesHeader properties={RESPONSE_PROPERTIES} />}
        >
          <PropertiesPanel row={responseRow} properties={RESPONSE_PROPERTIES} />
        </DetailSection>
      </ColumnStateProvider>

      <DetailSection title="Survey answers">
        <div className="space-y-3">
          {response.answers.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
              No structured answers.
            </div>
          ) : (
            response.answers.map((a, i) => <AnswerBlock key={i} answer={a} />)
          )}
        </div>
      </DetailSection>
    </main>
  );
}
