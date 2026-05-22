import { PrimaryNavClient } from "./primary-nav-client";
import type { NavSection } from "./primary-nav-client";
import { NAV_SECTION_ORDER } from "@/lib/views/seed";
import type { EntityKey } from "@/lib/views/types";

// Server-rendered nav metadata. Per-entity saved views are filled in
// client-side from localStorage via ViewsProvider — keeping that read out of
// the SSR boundary avoids hydration mismatches when the user has customized
// their view list. `entityKey` tells the client which entity's saved views
// to render below the section header; sections without it (Reports) render
// their static `views` array as before.

const ENTITY_SECTIONS: Record<EntityKey, NavSection> = {
  responses: {
    id: "responses",
    label: "Responses",
    icon: "MessageCircleMore",
    iconClass: "text-icon-responses",
    href: "/responses",
    entityKey: "responses",
  },
  customers: {
    id: "customers",
    label: "Customers",
    icon: "UserSquare2",
    iconClass: "text-icon-customers",
    href: "/customers",
    entityKey: "customers",
  },
  "team-members": {
    id: "team-members",
    label: "Team members",
    icon: "Users",
    iconClass: "text-icon-team-members",
    href: "/team-members",
    entityKey: "team-members",
  },
  tickets: {
    id: "tickets",
    label: "Tickets",
    icon: "Inbox",
    iconClass: "text-icon-tickets",
    href: "/tickets",
    entityKey: "tickets",
  },
};

const SECTIONS: NavSection[] = [
  ...NAV_SECTION_ORDER.map((key) => ENTITY_SECTIONS[key]),
  {
    id: "reports",
    label: "Reports",
    icon: "BarChart3",
    iconClass: "text-icon-reports",
    href: "/reports",
    views: [{ id: "new", label: "New report", href: "/reports" }],
  },
];

export function PrimaryNav() {
  return <PrimaryNavClient sections={SECTIONS} />;
}
