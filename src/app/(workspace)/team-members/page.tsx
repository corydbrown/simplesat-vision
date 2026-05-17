import Link from "next/link";
import { Star } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { TeamMemberPill } from "@/components/shared/entity-pill";
import { listTeamMembers } from "@/db/queries/team-members";
import { formatNumber } from "@/lib/format";
import { TEAM_MEMBER_VIEWS } from "@/lib/views";

function AvgRatingCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">-</span>;
  const tone =
    value < 3.5
      ? "text-red-600"
      : value < 4
        ? "text-amber-600"
        : "text-emerald-600";
  return (
    <span className={`inline-flex items-center gap-1 ${tone}`}>
      <Star size={11} className="fill-current" />
      <span className="tabular-nums font-medium">{value.toFixed(2)}</span>
    </span>
  );
}

function TeamPill({ team }: { team: string }) {
  const tone =
    team === "Tier 1"
      ? "bg-blue-50 text-blue-700 ring-blue-200"
      : "bg-violet-50 text-violet-700 ring-violet-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      {team}
    </span>
  );
}

export default async function TeamMembersPage(
  props: PageProps<"/team-members">,
) {
  const sp = await props.searchParams;
  const view = typeof sp.view === "string" ? sp.view : undefined;
  const { rows, total } = await listTeamMembers({ view });
  const activeView = TEAM_MEMBER_VIEWS.find((v) => v.id === (view ?? "all"));

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Team members", href: "/team-members" },
          { label: activeView?.label ?? "All members" },
        ]}
      />
      <div className="flex items-center justify-between border-b border-border bg-background px-5 py-1.5">
        <div className="text-xs text-muted-foreground">
          {formatNumber(total)} member{total === 1 ? "" : "s"}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              {[
                "ID",
                "Name",
                "Role",
                "Team",
                "Tickets handled",
                "Responses",
                "Avg rating",
              ].map((h) => (
                <th
                  key={h}
                  className="sticky top-0 z-10 bg-background px-3 py-2 text-left font-medium text-xs text-muted-foreground border-b border-r border-border"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="group hover:bg-accent/40">
                <td className="px-3 py-1.5 border-b border-r border-border font-mono text-xs text-muted-foreground">
                  <Link
                    href={`/team-members/${m.id}`}
                    className="hover:text-foreground"
                  >
                    {m.id}
                  </Link>
                </td>
                <td className="px-3 py-1.5 border-b border-r border-border">
                  <TeamMemberPill
                    id={m.id}
                    name={m.name}
                    avatarColor={m.avatarColor}
                  />
                </td>
                <td className="px-3 py-1.5 border-b border-r border-border text-muted-foreground">
                  {m.role}
                </td>
                <td className="px-3 py-1.5 border-b border-r border-border">
                  <TeamPill team={m.team} />
                </td>
                <td className="px-3 py-1.5 border-b border-r border-border tabular-nums">
                  {formatNumber(m.totalTickets)}
                </td>
                <td className="px-3 py-1.5 border-b border-r border-border tabular-nums text-muted-foreground">
                  {formatNumber(m.totalResponses)}
                </td>
                <td className="px-3 py-1.5 border-b border-r border-border">
                  <AvgRatingCell value={m.avgRating} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
