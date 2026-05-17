import {
  BarChart3,
  Home,
  Inbox,
  MessageSquareText,
  Plug,
  Settings,
  ShieldCheck,
  Star,
  Users,
  UserSquare2,
} from "lucide-react";
import { PrimaryNavLink } from "./nav-link";

export function PrimaryNav() {
  return (
    <nav className="flex w-[52px] shrink-0 flex-col items-center gap-0.5 border-r border-border bg-sidebar py-3 sticky top-0 h-screen">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded bg-foreground text-background text-sm font-semibold">
        S
      </div>
      <PrimaryNavLink
        href="/"
        icon={<Home size={16} />}
        label="Home"
        match="/"
      />
      <PrimaryNavLink
        href="/tickets"
        icon={<Inbox size={16} />}
        label="Tickets"
        match="/tickets"
      />
      <PrimaryNavLink
        href="/responses"
        icon={<Star size={16} />}
        label="Responses"
        match="/responses"
      />
      <PrimaryNavLink
        href="/customers"
        icon={<UserSquare2 size={16} />}
        label="Customers"
        match="/customers"
      />
      <PrimaryNavLink
        href="/team-members"
        icon={<Users size={16} />}
        label="Team members"
        match="/team-members"
      />
      <PrimaryNavLink
        href="/qa-evaluations"
        icon={<ShieldCheck size={16} />}
        label="QA evaluations (soon)"
        match="/qa-evaluations"
        dim
      />
      <div className="my-2 h-px w-6 bg-border" />
      <PrimaryNavLink
        href="/reports"
        icon={<BarChart3 size={16} />}
        label="Reports"
        match="/reports"
      />
      <PrimaryNavLink
        href="/surveys"
        icon={<MessageSquareText size={16} />}
        label="Surveys"
        match="/surveys"
      />
      <PrimaryNavLink
        href="/integrations"
        icon={<Plug size={16} />}
        label="Integrations"
        match="/integrations"
      />
      <div className="flex-1" />
      <PrimaryNavLink
        href="/settings"
        icon={<Settings size={16} />}
        label="Settings"
        match="/settings"
      />
    </nav>
  );
}
