"use client";

import { Star } from "lucide-react";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Avatar } from "@/components/shared/avatar";
import { ColumnStateProvider } from "@/lib/column-prefs";
import { TEAM_MEMBER_PROPERTIES } from "@/lib/properties/team-members";
import { TICKET_PROPERTIES } from "@/lib/properties/tickets";
import { RESPONSE_PROPERTIES } from "@/lib/properties/responses";
import { PropertiesPanel } from "@/components/shared/properties-panel";
import {
  DetailSection,
  PropertiesHeader,
} from "@/components/shared/detail-section";
import { EntityTable } from "@/components/shared/entity-table";
import { RelationTabs } from "@/components/shared/relation-tabs";
import { OpenInTable } from "@/components/shared/open-in-table";
import { initialsFromName } from "@/lib/color-from-name";
import { formatNumber } from "@/lib/format";
import type {
  TeamMemberDetail,
  TeamMemberListRow,
} from "@/db/queries/team-members";
import type { TicketsRow } from "@/db/queries/tickets";
import type { ResponseListRow } from "@/db/queries/responses";

function RatingHistogram({
  data,
}: {
  data: { rating: number; count: number }[];
}) {
  const byRating = new Map(data.map((d) => [d.rating, d.count]));
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((r) => {
        const c = byRating.get(r) ?? 0;
        const pct = (c / max) * 100;
        const barTone =
          r >= 4 ? "bg-emerald-400" : r === 3 ? "bg-amber-400" : "bg-red-400";
        return (
          <div key={r} className="flex items-center gap-2 text-sm">
            <span className="flex w-6 items-center gap-0.5 tabular-nums text-muted-foreground">
              <Star size={10} className="fill-amber-400 text-amber-400" />
              {r}
            </span>
            <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
              <div
                className={`h-full ${barTone}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-12 text-right tabular-nums text-muted-foreground">
              {formatNumber(c)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function TeamMemberDetailBody({
  member,
  memberRow,
  tickets,
  responses,
  histogram,
  inDrawer = false,
}: {
  member: TeamMemberDetail;
  memberRow: TeamMemberListRow;
  tickets: TicketsRow[];
  responses: ResponseListRow[];
  histogram: { rating: number; count: number }[];
  inDrawer?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramName = inDrawer ? "dt" : "tab";
  const rawTab = searchParams.get(paramName);
  const tab: "tickets" | "responses" =
    rawTab === "responses" ? "responses" : "tickets";

  useEffect(() => {
    if (!inDrawer || rawTab) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("dt", "tickets");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [inDrawer, rawTab, pathname, router, searchParams]);

  const avgRating = member.stats.avgRating;
  const isLowPerformer =
    avgRating != null && avgRating < 3.5 && member.stats.totalResponses >= 20;

  const header = (
    <div className="flex items-center gap-3">
      <Avatar
        bg={member.avatarColor}
        initials={initialsFromName(member.name)}
        size="xl"
      />
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight truncate">
          {member.name}
        </h1>
        <div className="mt-0.5 text-sm text-muted-foreground truncate">
          {member.role}
          <span className="mx-2 text-border">·</span>
          {member.team}
          <span className="mx-2 text-border">·</span>
          {member.email}
        </div>
      </div>
      {isLowPerformer && (
        <span className="ml-3 rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/20">
          Low performer
        </span>
      )}
    </div>
  );

  const properties = (
    <ColumnStateProvider
      tableId="team-member-detail"
      properties={TEAM_MEMBER_PROPERTIES}
    >
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Properties
        </h2>
        <PropertiesHeader properties={TEAM_MEMBER_PROPERTIES} />
      </div>
      <PropertiesPanel
        row={memberRow}
        properties={TEAM_MEMBER_PROPERTIES}
        layout={inDrawer ? "inline" : "stacked"}
      />
    </ColumnStateProvider>
  );

  const content = (
    <>
      <DetailSection title="Rating distribution">
        <div className="rounded-md border border-border bg-background px-5 py-4 max-w-2xl">
          <RatingHistogram data={histogram} />
        </div>
      </DetailSection>

      <div className="mt-6">
        <RelationTabs
          paramName={paramName}
          alwaysSet={inDrawer}
          tabs={[
            {
              id: "tickets",
              label: "Tickets",
              count: member.stats.totalTickets,
            },
            {
              id: "responses",
              label: "Responses",
              count: member.stats.totalResponses,
            },
          ]}
          trailing={
            <OpenInTable
              href={tab === "tickets" ? "/tickets" : "/responses"}
              label={`Open ${tab} as full table`}
            />
          }
        />
        {tab === "tickets" ? (
          <ColumnStateProvider
            tableId="team-member-tickets"
            properties={TICKET_PROPERTIES}
          >
            <EntityTable
              rows={tickets}
              idField="id"
              properties={TICKET_PROPERTIES}
              page={1}
              pageSize={Math.max(tickets.length, 1)}
              total={tickets.length}
              drawerEntity="ticket"
              paramPrefix={inDrawer ? "d" : ""}
              emptyMessage="No tickets handled yet."
            />
          </ColumnStateProvider>
        ) : (
          <ColumnStateProvider
            tableId="team-member-responses"
            properties={RESPONSE_PROPERTIES}
          >
            <EntityTable
              rows={responses}
              idField="id"
              properties={RESPONSE_PROPERTIES}
              page={1}
              pageSize={Math.max(responses.length, 1)}
              total={responses.length}
              drawerEntity="response"
              paramPrefix={inDrawer ? "d" : ""}
              emptyMessage="No responses yet."
            />
          </ColumnStateProvider>
        )}
      </div>
    </>
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
      <div className="mt-8 grid grid-cols-[1fr_260px] gap-10">
        <div className="min-w-0">{content}</div>
        <aside className="sticky top-14 self-start">{properties}</aside>
      </div>
    </main>
  );
}
