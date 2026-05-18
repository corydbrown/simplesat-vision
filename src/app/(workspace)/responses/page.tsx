import { Topbar } from "@/components/shell/topbar";
import { EntityTable } from "@/components/shared/entity-table";
import { EntityToolbar } from "@/components/shared/entity-toolbar";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { RESPONSE_PROPERTIES } from "@/lib/properties/responses";
import { listResponses } from "@/db/queries/responses";
import { RESPONSE_VIEWS } from "@/lib/views";

export default async function ResponsesPage(props: PageProps<"/responses">) {
  const sp = await props.searchParams;
  const view = typeof sp.view === "string" ? sp.view : undefined;
  const { rows, total } = await listResponses({ view, limit: 500 });
  const activeView = RESPONSE_VIEWS.find((v) => v.id === (view ?? "all"));

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
