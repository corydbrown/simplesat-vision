import {
  BarChart3,
  Home,
  Inbox,
  Settings,
  Star,
  UserSquare2,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  CUSTOMER_VIEWS,
  RESPONSE_VIEWS,
  TEAM_MEMBER_VIEWS,
  TICKET_VIEWS,
} from "@/lib/views";

export type SearchCategory =
  | "Pages"
  | "Customers"
  | "Tickets"
  | "Surveys"
  | "Team members"
  | "Responses";

export type SearchEntry = {
  id: string;
  category: SearchCategory;
  label: string;
  /** Dim secondary line — section name for views, email/status/etc. for entities. */
  secondary?: string;
  icon?: LucideIcon;
  href: string;
  /** Extra text appended to the searchable value so cmdk's fuzzy scorer can
   *  match against synonyms (e.g. typing "ratings" still finds Responses). */
  keywords?: string[];
};

type Section = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  views: { id: string; label: string }[];
  keywords?: string[];
};

const SECTIONS: Section[] = [
  {
    id: "responses",
    label: "Responses",
    icon: Star,
    href: "/responses",
    views: RESPONSE_VIEWS,
    keywords: ["surveys", "ratings", "feedback"],
  },
  {
    id: "customers",
    label: "Customers",
    icon: UserSquare2,
    href: "/customers",
    views: CUSTOMER_VIEWS,
    keywords: ["accounts", "users"],
  },
  {
    id: "team-members",
    label: "Team members",
    icon: Users,
    href: "/team-members",
    views: TEAM_MEMBER_VIEWS,
    keywords: ["agents", "staff", "people"],
  },
  {
    id: "tickets",
    label: "Tickets",
    icon: Inbox,
    href: "/tickets",
    views: TICKET_VIEWS,
    keywords: ["conversations", "issues"],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    href: "/reports",
    views: [{ id: "new", label: "New report" }],
    keywords: ["analytics", "dashboard"],
  },
];

function viewHref(sectionHref: string, viewId: string): string {
  return viewId === "all" ? sectionHref : `${sectionHref}?view=${viewId}`;
}

function buildIndex(): SearchEntry[] {
  const entries: SearchEntry[] = [
    {
      id: "page:home",
      category: "Pages",
      label: "Home",
      icon: Home,
      href: "/",
      keywords: ["insights", "dashboard"],
    },
    {
      id: "page:inbox",
      category: "Pages",
      label: "Inbox",
      icon: Inbox,
      href: "/inbox",
    },
    {
      id: "page:settings",
      category: "Pages",
      label: "Settings",
      icon: Settings,
      href: "/settings",
      keywords: ["preferences", "config"],
    },
  ];

  for (const s of SECTIONS) {
    entries.push({
      id: `page:${s.id}`,
      category: "Pages",
      label: s.label,
      icon: s.icon,
      href: s.href,
      keywords: s.keywords,
    });
    for (const v of s.views) {
      if (v.id === "all") continue; // section entry above already covers /responses, /tickets, etc.
      entries.push({
        id: `view:${s.id}:${v.id}`,
        category: "Pages",
        label: v.label,
        secondary: s.label,
        icon: s.icon,
        href: viewHref(s.href, v.id),
      });
    }
  }

  return entries;
}

export const STATIC_INDEX: SearchEntry[] = buildIndex();
