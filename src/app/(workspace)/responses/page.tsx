import { Topbar, type Crumb } from "@/components/shell/topbar";
import { EntityTable } from "@/components/shared/entity-table";
import { EntityToolbar } from "@/components/shared/entity-toolbar";
import { LayoutToggle } from "@/components/shared/layout-toggle";
import { ListFilterRow } from "@/components/shared/list-filter-row";
import { ListPageActions } from "@/components/shared/list-page-actions";
import { ViewBreadcrumb } from "@/components/shared/view-breadcrumb";
import { ResponseFeedCard } from "@/components/responses/response-feed-card";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { filtersFromSearchParam } from "@/lib/filters/url-state";
import { RESPONSE_GROUP_IDS } from "@/lib/group/fields/responses";
import { groupFromSearchParam } from "@/lib/group/url-state";
import { RESPONSE_PROPERTIES } from "@/lib/properties/responses";
import {
  ANSWER_PROPERTIES,
  type AnswerRow,
} from "@/lib/properties/response-answers";
import { parseSortParam } from "@/lib/sort/url-state";
import { listResponses } from "@/db/queries/responses";

// Three layouts. Feed is default — it's the most scannable view for what
// is fundamentally a stream of human-authored feedback.
const LAYOUT_OPTIONS = [
  { value: "feed", label: "Feed" },
  { value: "response", label: "Response per row" },
  { value: "answer", label: "Answer per row" },
];

type Layout = "feed" | "response" | "answer";

function parseLayout(raw: string | string[] | undefined): Layout {
  if (raw === "response" || raw === "answer" || raw === "feed") return raw;
  return "feed";
}

const VIEW_CONTEXT = {
  entityKey: "responses" as const,
  basePath: "/responses",
  allowedGroupIds: RESPONSE_GROUP_IDS,
};

export default async function ResponsesPage(props: PageProps<"/responses">) {
  const sp = await props.searchParams;
  const layout: Layout = parseLayout(
    typeof sp.layout === "string" ? sp.layout : undefined,
  );
  const responseGroupBy = groupFromSearchParam(sp.group, RESPONSE_GROUP_IDS);
  // Answer-row groupable ids — kept in sync with response-answers.tsx.
  // Inlined here because that file is "use client", so we can't iterate
  // its exports from a server component.
  const answerGroupBy = groupFromSearchParam(sp.group, [
    "type",
    "customer",
    "team_member",
  ]);

  const sortParam = typeof sp.sort === "string" ? sp.sort : undefined;
  // Answer layout uses its own property registry whose sort keys don't map
  // to listResponses columns — let the table client-sort there. Other
  // layouts can sort on the server.
  const sorts = layout === "answer" ? [] : parseSortParam(sortParam);
  const filters = filtersFromSearchParam(sp.f);
  const { rows, total } = await listResponses({
    limit: 500,
    sorts,
    groupBy: layout === "response" ? responseGroupBy : null,
    filters,
  });

  const crumbs: Crumb[] = [
    { label: "Responses", href: "/responses" },
    {
      label: "All responses",
      node: <ViewBreadcrumb entityKey="responses" />,
    },
  ];
  const toolbarTrailing = (
    <LayoutToggle basePath="/responses" options={LAYOUT_OPTIONS} />
  );

  if (layout === "feed") {
    return (
      <ColumnStateProvider
        tableId="responses"
        properties={RESPONSE_PROPERTIES}
        entityKey="responses"
      >
        <Topbar
          crumbs={crumbs}
          actions={
            <ListPageActions entityKey="responses" basePath="/responses" />
          }
        />
        <EntityToolbar
          properties={RESPONSE_PROPERTIES}
          searchPlaceholder="Search responses..."
          trailing={toolbarTrailing}
          viewContext={VIEW_CONTEXT}
        />
        <ListFilterRow properties={RESPONSE_PROPERTIES} />
        <main className="mx-auto w-full max-w-3xl px-6 py-6">
          <div className="space-y-3">
            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
                No responses match this view.
              </div>
            ) : (
              rows.map((r) => <ResponseFeedCard key={r.id} row={r} />)
            )}
          </div>
        </main>
      </ColumnStateProvider>
    );
  }

  if (layout === "answer") {
    const answerRows: AnswerRow[] = rows.flatMap((r) =>
      r.answers.map((answer, idx) => ({
        id: `${r.id}::${idx}`,
        responseId: r.id,
        questionIndex: idx,
        answer,
        respondedAt: r.respondedAt,
        ticketId: r.ticketId,
        ticketSubject: r.ticketSubject,
        ticketExternalId: r.ticketExternalId,
        customerId: r.customerId,
        customerName: r.customerName,
        teamMemberId: r.teamMemberId,
        teamMemberName: r.teamMemberName,
        teamMemberAvatarColor: r.teamMemberAvatarColor,
      })),
    );

    return (
      <ColumnStateProvider
        tableId="response-answers"
        properties={ANSWER_PROPERTIES}
      >
        <Topbar
          crumbs={crumbs}
          actions={
            <ListPageActions entityKey="responses" basePath="/responses" />
          }
        />
        <EntityToolbar
          properties={ANSWER_PROPERTIES}
          searchPlaceholder="Search answers..."
          trailing={toolbarTrailing}
          viewContext={VIEW_CONTEXT}
        />
        <ListFilterRow properties={RESPONSE_PROPERTIES} />
        <EntityTable
          rows={answerRows}
          idField="id"
          rowHrefField="responseId"
          properties={ANSWER_PROPERTIES}
          page={1}
          pageSize={Math.max(answerRows.length, 1)}
          total={answerRows.length}
          groupBy={answerGroupBy?.propertyId}
          basePath="/responses"
          drawerEntity="response"
        />
        {/* answer layout intentionally omits serverSorted so EntityTable
            applies the URL sort client-side over the flattened answer rows. */}
      </ColumnStateProvider>
    );
  }

  return (
    <ColumnStateProvider
      tableId="responses"
      properties={RESPONSE_PROPERTIES}
      entityKey="responses"
    >
      <Topbar
        crumbs={crumbs}
        actions={
          <ListPageActions entityKey="responses" basePath="/responses" />
        }
      />
      <EntityToolbar
        properties={RESPONSE_PROPERTIES}
        searchPlaceholder="Search responses..."
        trailing={toolbarTrailing}
        viewContext={VIEW_CONTEXT}
      />
      <ListFilterRow properties={RESPONSE_PROPERTIES} />
      <EntityTable
        rows={rows}
        idField="id"
        properties={RESPONSE_PROPERTIES}
        page={1}
        pageSize={Math.max(rows.length, 1)}
        total={total}
        groupBy={responseGroupBy?.propertyId}
        basePath="/responses"
        drawerEntity="response"
        serverSorted
      />
    </ColumnStateProvider>
  );
}
