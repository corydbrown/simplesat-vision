import Link from "next/link";
import {
  BarChart3,
  Home,
  Inbox,
  MessageSquareText,
  Plug,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  UserSquare2,
} from "lucide-react";
import { getSidebarCounts } from "@/db/queries/counts";
import { formatNumber } from "@/lib/format";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-4 pb-1 text-xs font-medium text-muted-foreground/80 uppercase tracking-wide">
      {children}
    </div>
  );
}

function NavLink({
  href,
  icon,
  label,
  meta,
  dim,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  meta?: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-sidebar-accent ${
        dim ? "text-muted-foreground/70" : "text-sidebar-foreground"
      }`}
    >
      <span className="text-muted-foreground group-hover:text-sidebar-foreground">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {meta != null && (
        <span className="text-xs tabular-nums text-muted-foreground">
          {meta}
        </span>
      )}
    </Link>
  );
}

export async function Sidebar() {
  const counts = await getSidebarCounts();

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-sidebar h-screen sticky top-0 flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-foreground text-background flex items-center justify-center text-xs font-semibold">
            S
          </div>
          <div className="text-sm font-semibold">Simplesat</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <SectionLabel>Workspace</SectionLabel>
        <NavLink href="/" icon={<Home size={14} />} label="Home" />
        <NavLink
          href="/reports"
          icon={<BarChart3 size={14} />}
          label="Reports"
        />

        <SectionLabel>Data</SectionLabel>
        <NavLink
          href="/tickets"
          icon={<Inbox size={14} />}
          label="Tickets"
          meta={formatNumber(counts.tickets)}
        />
        <NavLink
          href="/responses"
          icon={<Star size={14} />}
          label="Responses"
          meta={formatNumber(counts.responses)}
        />
        <NavLink
          href="/customers"
          icon={<UserSquare2 size={14} />}
          label="Customers"
          meta={formatNumber(counts.customers)}
        />
        <NavLink
          href="/team-members"
          icon={<Users size={14} />}
          label="Team members"
          meta={formatNumber(counts.teamMembers)}
        />
        <NavLink
          href="/qa-evaluations"
          icon={<ShieldCheck size={14} />}
          label="QA evaluations"
          dim
          meta={
            <span className="rounded bg-muted px-1 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Soon
            </span>
          }
        />

        <SectionLabel>Configure</SectionLabel>
        <NavLink
          href="/surveys"
          icon={<MessageSquareText size={14} />}
          label="Surveys"
        />
        <NavLink
          href="/integrations"
          icon={<Plug size={14} />}
          label="Integrations"
        />
        <NavLink
          href="/settings"
          icon={<Settings size={14} />}
          label="Settings"
        />
      </nav>

      <div className="px-3 py-3 border-t border-border text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Sparkles size={12} />
        <span>Vision prototype - phase 1</span>
      </div>
    </aside>
  );
}
