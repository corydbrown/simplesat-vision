import {
  CUSTOMER_VIEWS,
  RESPONSE_VIEWS,
  TEAM_MEMBER_VIEWS,
  TICKET_VIEWS,
} from "@/lib/views";
import { PrimaryNavClient } from "./primary-nav-client";
import type { NavSection } from "./primary-nav-client";

// Server-rendered nav data. Counts removed per Notion-style cleanliness —
// users get totals on the list page header instead.

const SECTIONS: NavSection[] = [
  {
    id: "responses",
    label: "Responses",
    icon: "Star",
    href: "/responses",
    views: RESPONSE_VIEWS.map((v) => ({
      id: v.id,
      label: v.label,
      href: v.id === "all" ? "/responses" : `/responses?view=${v.id}`,
    })),
  },
  {
    id: "customers",
    label: "Customers",
    icon: "UserSquare2",
    href: "/customers",
    views: CUSTOMER_VIEWS.map((v) => ({
      id: v.id,
      label: v.label,
      href: v.id === "all" ? "/customers" : `/customers?view=${v.id}`,
    })),
  },
  {
    id: "team-members",
    label: "Team members",
    icon: "Users",
    href: "/team-members",
    views: TEAM_MEMBER_VIEWS.map((v) => ({
      id: v.id,
      label: v.label,
      href: v.id === "all" ? "/team-members" : `/team-members?view=${v.id}`,
    })),
  },
  {
    id: "tickets",
    label: "Tickets",
    icon: "Inbox",
    href: "/tickets",
    views: TICKET_VIEWS.map((v) => ({
      id: v.id,
      label: v.label,
      href: v.id === "all" ? "/tickets" : `/tickets?view=${v.id}`,
    })),
  },
  {
    id: "reports",
    label: "Reports",
    icon: "BarChart3",
    href: "/reports",
    views: [{ id: "new", label: "New report", href: "/reports" }],
  },
];

export function PrimaryNav() {
  return <PrimaryNavClient sections={SECTIONS} />;
}
