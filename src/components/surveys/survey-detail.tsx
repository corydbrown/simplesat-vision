"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { decodeGroup } from "@/lib/group/url-state";
import { recordEntityView } from "@/lib/recent-pages";
import { SURVEY_PROPERTIES, SURVEY_METRIC_LABEL } from "@/lib/properties/surveys";
import { RESPONSE_PROPERTIES } from "@/lib/properties/responses";
import { PropertiesPanel } from "@/components/shared/properties-panel";
import {
  DetailSection,
  PropertiesPanelHeader,
  PropertiesSidebar,
} from "@/components/shared/detail-section";
import { EntityTable } from "@/components/shared/entity-table";
import { GroupControl } from "@/components/shared/group-control";
import { SortControl } from "@/components/shared/sort-control";
import type { SurveyDetail, SurveyRow } from "@/db/queries/surveys";
import type { ResponseListRow } from "@/db/queries/responses";
import { formatNumber } from "@/lib/format";

export function SurveyDetailBody({
  survey,
  surveyRow,
  responses,
  inDrawer = false,
}: {
  survey: SurveyDetail;
  surveyRow: SurveyRow;
  responses: ResponseListRow[];
  inDrawer?: boolean;
}) {
  const searchParams = useSearchParams();
  const paramPrefix = inDrawer ? "d" : "";
  const responseGroupAllowed = RESPONSE_PROPERTIES.filter(
    (p) => p.groupable === true,
  ).map((p) => p.id);
  const responseGroup = decodeGroup(
    searchParams.get(`${paramPrefix}group`),
    responseGroupAllowed,
  );

  useEffect(() => {
    // Drawer side records via global-drawer.tsx; standalone records here.
    if (inDrawer) return;
    recordEntityView({
      entity: "survey",
      id: survey.id,
      label: survey.name,
      secondary: SURVEY_METRIC_LABEL[survey.metric],
    });
  }, [inDrawer, survey.id, survey.name, survey.metric]);

  const header = (
    <div className="min-w-0">
      <div className="text-sm text-muted-foreground">
        {SURVEY_METRIC_LABEL[survey.metric]} survey
      </div>
      <h1 className="mt-0.5 text-3xl font-semibold tracking-tight truncate">
        {survey.name}
      </h1>
      <div className="mt-1 text-sm text-muted-foreground">
        {formatNumber(survey.stats.totalResponses)} responses
        {survey.stats.avgRating != null && (
          <>
            <span className="mx-2 text-border">·</span>
            avg {survey.stats.avgRating.toFixed(2)}/{survey.scale}
          </>
        )}
      </div>
    </div>
  );

  const properties = (
    <ColumnStateProvider tableId="survey-detail" properties={SURVEY_PROPERTIES}>
      <PropertiesPanelHeader
        properties={SURVEY_PROPERTIES}
        layout={inDrawer ? "inline" : "stacked"}
      />
      <PropertiesPanel
        row={surveyRow}
        properties={SURVEY_PROPERTIES}
        rowEntity="Survey"
        layout={inDrawer ? "inline" : "stacked"}
      />
    </ColumnStateProvider>
  );

  const questions = (
    <DetailSection title="Questions">
      <ol className="space-y-2">
        {survey.questions.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
            No questions configured.
          </div>
        ) : (
          survey.questions.map((q, i) => (
            <li
              key={i}
              className="rounded-md border border-border bg-background px-4 py-3"
            >
              <div className="text-sm text-foreground">{q.question}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {q.type === "rating"
                  ? `Rating · scale ${q.scale}`
                  : q.type === "multi-choice"
                    ? `Multi-choice · ${q.options.length} options`
                    : q.type === "multi-select"
                      ? `Multi-select · ${q.options.length} options`
                      : "Comment"}
              </div>
            </li>
          ))
        )}
      </ol>
    </DetailSection>
  );

  const responsesTable = (
    <DetailSection
      title={`Recent responses (${responses.length})`}
      trailing={
        <div className="flex items-center gap-1">
          <SortControl
            properties={RESPONSE_PROPERTIES}
            paramPrefix={paramPrefix}
          />
          <GroupControl
            properties={RESPONSE_PROPERTIES}
            paramPrefix={paramPrefix}
          />
        </div>
      }
    >
      <ColumnStateProvider
        tableId="survey-responses"
        properties={RESPONSE_PROPERTIES}
      >
        <EntityTable
          rows={responses}
          idField="id"
          properties={RESPONSE_PROPERTIES}
          page={1}
          pageSize={Math.max(responses.length, 1)}
          total={responses.length}
          groupBy={responseGroup?.propertyId}
          drawerEntity="response"
          paramPrefix={paramPrefix}
          emptyMessage="No responses yet."
        />
      </ColumnStateProvider>
    </DetailSection>
  );

  if (inDrawer) {
    return (
      <main className="px-10 py-7">
        {header}
        <div className="mt-6">{properties}</div>
        <div className="mt-6 space-y-6">
          {questions}
          {responsesTable}
        </div>
      </main>
    );
  }

  return (
    <main className="px-14 py-10">
      {header}
      <div className="mt-8 grid grid-cols-[1fr_auto] gap-10">
        <div className="min-w-0 space-y-8">
          {questions}
          {responsesTable}
        </div>
        <PropertiesSidebar>{properties}</PropertiesSidebar>
      </div>
    </main>
  );
}
