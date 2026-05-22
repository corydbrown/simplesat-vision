"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { recordEntityView } from "@/lib/recent-pages";
import { RESPONSE_PROPERTIES } from "@/lib/properties/responses";
import { PropertiesPanel } from "@/components/shared/properties-panel";
import {
  DetailSection,
  PropertiesPanelHeader,
  PropertiesSidebar,
} from "@/components/shared/detail-section";
import { StarRating } from "@/components/shared/star-rating";
import type { ResponseDetail } from "@/db/queries/responses";
import type { ResponseListRow } from "@/db/queries/responses";
import { formatDateTime } from "@/lib/format";
import type { SurveyAnswer } from "@/db/schema";

function AnswerBlock({ answer }: { answer: SurveyAnswer }) {
  return (
    <div className="rounded-md border border-border bg-background px-4 py-3">
      <div className="text-base text-muted-foreground">{answer.question}</div>
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
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm ${
                    active
                      ? "bg-green-lighter text-green-darker font-medium"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {active && <Check size={12} />}
                  {opt}
                </span>
              );
            })}
          </div>
        )}
        {answer.type === "multi-select" && (
          <div className="flex flex-wrap gap-1.5">
            {answer.value.length === 0 ? (
              <span className="text-base text-muted-foreground">
                Nothing selected
              </span>
            ) : (
              answer.value.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-lighter px-2 py-0.5 text-sm font-medium text-blue-darker"
                >
                  <Check size={12} />
                  {v}
                </span>
              ))
            )}
            {answer.value.length > 0 && (
              <span className="text-base text-muted-foreground self-center">
                of {answer.options.length} options
              </span>
            )}
          </div>
        )}
        {answer.type === "comment" && (
          <blockquote className="border-l-2 border-border pl-3 text-base text-foreground/80">
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
  inDrawer = false,
}: {
  response: ResponseDetail;
  responseRow: ResponseListRow;
  inDrawer?: boolean;
}) {
  useEffect(() => {
    // Drawer side records via global-drawer.tsx; standalone records here.
    if (inDrawer) return;
    const who = response.customer?.name;
    const label = who
      ? `${response.rating}/${response.scale} from ${who}`
      : `${response.rating}/${response.scale} response`;
    const comment = response.comment?.replace(/\s+/g, " ").trim();
    recordEntityView({
      entity: "response",
      id: response.id,
      label,
      secondary: comment
        ? comment.length > 60
          ? `${comment.slice(0, 60)}…`
          : comment
        : undefined,
    });
  }, [
    inDrawer,
    response.id,
    response.rating,
    response.scale,
    response.customer?.name,
    response.comment,
  ]);

  const tone =
    response.rating <= 2
      ? "text-red-dark"
      : response.rating === 3
        ? "text-yellow-dark"
        : "text-green-dark";

  const header = (
    <div className="flex items-baseline gap-3 min-w-0">
      <h1 className={`text-3xl font-semibold tracking-tight ${tone}`}>
        {response.rating}/{response.scale}
      </h1>
      <span className="text-base text-muted-foreground capitalize">
        {response.surveyType} response
      </span>
      <span className="text-muted-foreground/60">·</span>
      <span className="text-base text-muted-foreground tabular-nums">
        {formatDateTime(response.respondedAt)}
      </span>
    </div>
  );

  const properties = (
    <ColumnStateProvider
      tableId="response-detail"
      properties={RESPONSE_PROPERTIES}
    >
      <PropertiesPanelHeader
        properties={RESPONSE_PROPERTIES}
        layout={inDrawer ? "inline" : "stacked"}
      />
      <PropertiesPanel
        row={responseRow}
        properties={RESPONSE_PROPERTIES}
        rowEntity="Response"
        layout={inDrawer ? "inline" : "stacked"}
      />
    </ColumnStateProvider>
  );

  const content = (
    <DetailSection title="Survey answers">
      <div className="space-y-3">
        {response.answers.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-5 py-4 text-base text-muted-foreground">
            No structured answers.
          </div>
        ) : (
          response.answers.map((a, i) => <AnswerBlock key={i} answer={a} />)
        )}
      </div>
    </DetailSection>
  );

  if (inDrawer) {
    return (
      <main className="px-10 py-7">
        {header}
        <div className="mt-6">{properties}</div>
        <div className="mt-6">{content}</div>
      </main>
    );
  }

  return (
    <main className="px-14 py-10">
      {header}
      <div className="mt-8 grid grid-cols-[1fr_auto] gap-10">
        <div className="min-w-0">{content}</div>
        <PropertiesSidebar>{properties}</PropertiesSidebar>
      </div>
    </main>
  );
}
