import { Topbar } from "@/components/shell/topbar";
import { EntityTable } from "@/components/shared/entity-table";
import { EntityToolbar } from "@/components/shared/entity-toolbar";
import { LayoutToggle } from "@/components/shared/layout-toggle";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { RESPONSE_PROPERTIES } from "@/lib/properties/responses";
import {
  ANSWER_PROPERTIES,
  type AnswerRow,
} from "@/lib/properties/response-answers";
import { listResponses } from "@/db/queries/responses";
import { RESPONSE_VIEWS } from "@/lib/views";

const LAYOUT_OPTIONS = [
  { value: "response", label: "Response per row" },
  { value: "answer", label: "Answer per row" },
];

export default async function ResponsesPage(props: PageProps<"/responses">) {
  const sp = await props.searchParams;
  const view = typeof sp.view === "string" ? sp.view : undefined;
  const layout =
    typeof sp.layout === "string" && sp.layout === "answer"
      ? "answer"
      : "response";

  const { rows, total } = await listResponses({ view, limit: 500 });
  const activeView = RESPONSE_VIEWS.find((v) => v.id === (view ?? "all"));

  const toolbarTrailing = (
    <LayoutToggle basePath="/responses" options={LAYOUT_OPTIONS} />
  );

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
          crumbs={[
            { label: "Responses", href: "/responses" },
            { label: activeView?.label ?? "All responses" },
          ]}
        />
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
          stickyId="question"
          page={1}
          pageSize={Math.max(answerRows.length, 1)}
          total={answerRows.length}
          basePath="/responses"
          rowHrefBase="/responses"
        />
      </ColumnStateProvider>
    );
  }

  return (
    <ColumnStateProvider tableId="responses" properties={RESPONSE_PROPERTIES}>
      <Topbar
        crumbs={[
          { label: "Responses", href: "/responses" },
          { label: activeView?.label ?? "All responses" },
        ]}
      />
      <EntityToolbar
        properties={RESPONSE_PROPERTIES}
        searchPlaceholder="Search responses..."
        trailing={toolbarTrailing}
      />
      <EntityTable
        rows={rows}
        idField="id"
        properties={RESPONSE_PROPERTIES}
        stickyId="comment"
        page={1}
        pageSize={Math.max(rows.length, 1)}
        total={total}
        basePath="/responses"
        rowHrefBase="/responses"
      />
    </ColumnStateProvider>
  );
}
