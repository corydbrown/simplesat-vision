"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bot } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { EntityTable } from "@/components/shared/entity-table";
import { EntityToolbar } from "@/components/shared/entity-toolbar";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { AGENT_PROPERTIES } from "@/lib/properties/agents";
import type { AgentRosterRow } from "@/db/queries/team-members";
import type { TeamMemberKind } from "@/db/schema";

const KIND_TABS: {
  id: "all" | TeamMemberKind;
  label: string;
  param: string | null;
}[] = [
  { id: "all", label: "All", param: null },
  { id: "human", label: "Humans", param: "human" },
  { id: "ai_agent", label: "AI agents", param: "ai_agent" },
];

function KindFilterTabs({
  activeKind,
}: {
  activeKind: TeamMemberKind | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = activeKind ?? "all";

  function buildHref(param: string | null): string {
    const next = new URLSearchParams(searchParams.toString());
    if (param == null) next.delete("kind");
    else next.set("kind", param);
    // Reset pagination + drawer when flipping the filter — old ids may not be
    // in the new row set.
    next.delete("page");
    const qs = next.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex items-center gap-1 border-b border-border bg-background px-gutter py-2">
      {KIND_TABS.map((t) => {
        const active = t.id === current;
        return (
          <Link
            key={t.id}
            href={buildHref(t.param)}
            scroll={false}
            className={`cursor-pointer rounded-full px-3 py-1 text-base transition-colors ${
              active
                ? "bg-accent text-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

function AiAgentsEmptyHint() {
  return (
    <div className="flex items-start gap-3 border-b border-border bg-purple-lighter/40 px-gutter py-3 text-base text-purple-darker">
      <Bot size={18} className="mt-0.5 shrink-0" />
      <div>
        AI agents will appear here once Fin or another bot sends a message in
        this workspace. Phase 1c&rsquo;s ingest hook handles the lazy-create on
        first bot turn.
      </div>
    </div>
  );
}

export function AgentsListView({
  rows,
  total,
  activeKind,
  aiAgentCount,
}: {
  rows: AgentRosterRow[];
  total: number;
  activeKind: TeamMemberKind | null;
  aiAgentCount: number;
}) {
  return (
    <ColumnStateProvider tableId="agents" properties={AGENT_PROPERTIES}>
      <Topbar crumbs={[{ label: "Agents" }]} />
      <KindFilterTabs activeKind={activeKind} />
      {aiAgentCount === 0 && activeKind !== "human" && <AiAgentsEmptyHint />}
      <EntityToolbar
        properties={AGENT_PROPERTIES}
        searchPlaceholder="Search agents..."
      />
      <EntityTable
        rows={rows}
        idField="id"
        properties={AGENT_PROPERTIES}
        page={1}
        pageSize={total || 1}
        total={total}
        basePath="/agents"
        drawerEntity="team-member"
        serverSorted
        emptyMessage="No agents match this filter."
      />
    </ColumnStateProvider>
  );
}
