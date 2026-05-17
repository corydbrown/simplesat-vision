import Link from "next/link";
import { Star } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import {
  CompanyPill,
  CustomerPill,
} from "@/components/shared/entity-pill";
import { listCustomers } from "@/db/queries/customers";
import { formatDate, formatNumber } from "@/lib/format";
import { CUSTOMER_VIEWS } from "@/lib/views";

const TIER_LABEL: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

const TIER_TONE: Record<string, string> = {
  starter: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  pro: "bg-blue-50 text-blue-700 ring-blue-200",
  enterprise: "bg-purple-50 text-purple-700 ring-purple-200",
};

function TierPill({ tier }: { tier: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TIER_TONE[tier]}`}
    >
      {TIER_LABEL[tier] ?? tier}
    </span>
  );
}

function AvgRatingCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">-</span>;
  const tone =
    value < 3
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

export default async function CustomersPage(props: PageProps<"/customers">) {
  const sp = await props.searchParams;
  const view = typeof sp.view === "string" ? sp.view : undefined;
  const { rows, total } = await listCustomers({ view });
  const activeView = CUSTOMER_VIEWS.find((v) => v.id === (view ?? "all"));

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Customers", href: "/customers" },
          { label: activeView?.label ?? "All customers" },
        ]}
      />
      <div className="flex items-center justify-between border-b border-border bg-background px-5 py-1.5">
        <div className="text-xs text-muted-foreground">
          {formatNumber(total)} customer{total === 1 ? "" : "s"}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              {[
                "ID",
                "Name",
                "Company",
                "Tier",
                "Tickets",
                "Avg rating",
                "Last seen",
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
            {rows.map((c) => (
              <tr key={c.id} className="group hover:bg-accent/40">
                <td className="px-3 py-1.5 border-b border-r border-border font-mono text-xs text-muted-foreground">
                  <Link
                    href={`/customers/${c.id}`}
                    className="hover:text-foreground"
                  >
                    {c.id}
                  </Link>
                </td>
                <td className="px-3 py-1.5 border-b border-r border-border">
                  <CustomerPill id={c.id} name={c.name} />
                </td>
                <td className="px-3 py-1.5 border-b border-r border-border">
                  <CompanyPill name={c.company} />
                </td>
                <td className="px-3 py-1.5 border-b border-r border-border">
                  <TierPill tier={c.tier} />
                </td>
                <td className="px-3 py-1.5 border-b border-r border-border tabular-nums">
                  {formatNumber(c.totalTickets)}
                </td>
                <td className="px-3 py-1.5 border-b border-r border-border">
                  <AvgRatingCell value={c.avgRating} />
                </td>
                <td className="px-3 py-1.5 border-b border-r border-border tabular-nums text-muted-foreground">
                  {formatDate(c.lastSeen)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
