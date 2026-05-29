import { Topbar } from "@/components/shell/topbar";
import { EntityTable } from "@/components/shared/entity-table";
import { EntityToolbar } from "@/components/shared/entity-toolbar";
import { ListFilterRow } from "@/components/shared/list-filter-row";
import { ListPageActions } from "@/components/shared/list-page-actions";
import { NewEvaluationDialog } from "@/components/qa/new-evaluation-dialog";
import { ViewBreadcrumb } from "@/components/shared/view-breadcrumb";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { filtersFromSearchParam } from "@/lib/filters/url-state";
import { COACHING_GROUP_IDS } from "@/lib/group/fields/coaching";
import { groupFromSearchParam } from "@/lib/group/url-state";
import { COACHING_PROPERTIES, coachingRowHref } from "@/lib/properties/coaching";
import { parseSortParam } from "@/lib/sort/url-state";
import { listEvaluations } from "@/db/queries/evaluations";

// SVP-243: NewEvaluationDialog + EvaluateTicketButton both call `evaluateTicket`
// from this route. Lift the function ceiling so the LLM round-trip (~15-25s)
// has cold-start headroom. Mirrors `/coaching/[evaluationId]` and `/tickets/[id]`.
export const maxDuration = 60;

const PAGE_SIZE = 50;

function parsePage(v: string | undefined): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export default async function CoachingPage(props: PageProps<"/coaching">) {
  const sp = await props.searchParams;
  const sorts = parseSortParam(
    typeof sp.sort === "string" ? sp.sort : undefined,
  );
  const page = parsePage(typeof sp.page === "string" ? sp.page : undefined);
  const filters = filtersFromSearchParam(sp.f);
  const groupBy = groupFromSearchParam(sp.group, COACHING_GROUP_IDS);

  const { rows, total } = await listEvaluations({
    page,
    pageSize: PAGE_SIZE,
    sorts,
    filters,
    groupBy,
  });

  return (
    <ColumnStateProvider
      tableId="coaching"
      properties={COACHING_PROPERTIES}
      entityKey="coaching"
    >
      <Topbar
        crumbs={[
          { label: "Coaching", href: "/coaching" },
          {
            label: "All evaluations",
            node: <ViewBreadcrumb entityKey="coaching" />,
          },
        ]}
        actions={
          <div className="flex items-center gap-1.5">
            <NewEvaluationDialog />
            <ListPageActions entityKey="coaching" basePath="/coaching" />
          </div>
        }
      />
      <EntityToolbar
        properties={COACHING_PROPERTIES}
        searchPlaceholder="Search evaluations..."
        viewContext={{
          entityKey: "coaching",
          basePath: "/coaching",
          allowedGroupIds: COACHING_GROUP_IDS,
        }}
      />
      <ListFilterRow properties={COACHING_PROPERTIES} />
      <EntityTable
        rows={rows}
        idField="id"
        properties={COACHING_PROPERTIES}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        groupBy={groupBy?.propertyId}
        basePath="/coaching"
        rowHref={coachingRowHref}
        serverSorted
      />
    </ColumnStateProvider>
  );
}
