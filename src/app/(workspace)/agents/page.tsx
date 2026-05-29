import { AgentsListView } from "@/components/agents/agents-list-view";
import { listAgents } from "@/db/queries/team-members";
import { parseSortParam } from "@/lib/sort/url-state";
import type { TeamMemberKind } from "@/db/schema";

function parseKindParam(raw: unknown): TeamMemberKind | undefined {
  if (raw === "human" || raw === "ai_agent") return raw;
  return undefined;
}

export default async function AgentsPage(props: PageProps<"/agents">) {
  const sp = await props.searchParams;
  const kind = parseKindParam(sp.kind);
  const sorts = parseSortParam(
    typeof sp.sort === "string" ? sp.sort : undefined,
  );

  const { rows, total, aiAgentCount } = await listAgents({ kind, sorts });

  return (
    <AgentsListView
      rows={rows}
      total={total}
      activeKind={kind ?? null}
      aiAgentCount={aiAgentCount}
    />
  );
}
