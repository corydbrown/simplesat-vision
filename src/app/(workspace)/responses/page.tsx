import { Topbar } from "@/components/shell/topbar";
import { EntityTable } from "@/components/shared/entity-table";
import { EntityToolbar } from "@/components/shared/entity-toolbar";
import { LayoutToggle } from "@/components/shared/layout-toggle";
import { ResponseFeedCard } from "@/components/responses/response-feed-card";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { RESPONSE_PROPERTIES } from "@/lib/properties/responses";
import {
  ANSWER_PROPERTIES,
  type AnswerRow,
} from "@/lib/properties/response-answers";
import { parseSortParam } from "@/lib/sort/url-state";
import { listResponses } from "@/db/queries/responses";
import { RESPONSE_VIEWS } from "@/lib/views";

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

export default async function ResponsesPage(props: PageProps<"/responses">) {
  const sp = await props.searchParams;
  const view = typeof sp.view === "string" ? sp.view : undefined;
  const layout: Layout = parseLayout(
    typeof sp.layout === "string" ? sp.layout : undefined,
  );

  const sortParam = typeof sp.sort === "string" ? sp.sort : undefined;
  // Answer layout uses its own property registry whose sort keys don't map
  // to listResponses columns — let the table client-sort there. Other
  // layouts can sort on the server.
  const sorts = layout === "answer" ? [] : parseSortParam(sortParam);
  const { rows, total } = await listResponses({ view, limit: 500, sorts });
  const activeView = RESPONSE_VIEWS.find((v) => v.id === (view ?? "all"));

  const crumbs = [
    { label: "Responses", href: "/responses" },
    { label: activeView?.label ?? "All responses" },
  ];
  const toolbarTrailing = (
    <LayoutToggle basePath="/responses" options={LAYOUT_OPTIONS} />
  );

  if (layout === "feed") {
    return (
      <ColumnStateProvider tableId="responses" properties={RESPONSE_PROPERTIES}>
        <Topbar crumbs={crumbs} />
        <EntityToolbar
          properties={RESPONSE_PROPERTIES}
          searchPlaceholder="Search responses..."
          trailing={toolbarTrailing}
        />
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
        <Topbar crumbs={crumbs} />
        <EntityToolbar
          properties={ANSWER_PROPERTIES}
          searchPlaceholder="Search answers..."
          trailing={toolbarTrailing}
        />
        <EntityTable
          rows={answerRows}
          idField="id"
          rowHrefField="responseId"
          properties={ANSWER_PROPERTIES}
          page={1}
          pageSize={Math.max(answerRows.length, 1)}
          total={answerRows.length}
          basePath="/responses"
          drawerEntity="response"
        />
        {/* answer layout intentionally omits serverSorted so EntityTable
            applies the URL sort client-side over the flattened answer rows. */}
      </ColumnStateProvider>
    );
  }

  return (
    <ColumnStateProvider tableId="responses" properties={RESPONSE_PROPERTIES}>
      <Topbar crumbs={crumbs} />
      <EntityToolbar
        properties={RESPONSE_PROPERTIES}
        searchPlaceholder="Search responses..."
        trailing={toolbarTrailing}
      />
      <EntityTable
        rows={rows}
        idField="id"
        properties={RESPONSE_PROPERTIES}
        page={1}
        pageSize={Math.max(rows.length, 1)}
        total={total}
        basePath="/responses"
        drawerEntity="response"
        serverSorted
      />
    </ColumnStateProvider>
  );
}
