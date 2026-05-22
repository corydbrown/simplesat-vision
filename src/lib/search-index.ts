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

// Section-level pages only. Per-entity saved views are now dynamic
// (localStorage via ViewsProvider) so the palette renders them through a
// separate dynamic group rather than baking them into the static index.
const SECTIONS: {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  keywords?: string[];
}[] = [
  {
    id: "responses",
    label: "Responses",
    icon: Star,
    href: "/responses",
    keywords: ["surveys", "ratings", "feedback"],
  },
  {
    id: "customers",
    label: "Customers",
    icon: UserSquare2,
    href: "/customers",
    keywords: ["accounts", "users"],
  },
  {
    id: "team-members",
    label: "Team members",
    icon: Users,
    href: "/team-members",
    keywords: ["agents", "staff", "people"],
  },
  {
    id: "tickets",
    label: "Tickets",
    icon: Inbox,
    href: "/tickets",
    keywords: ["conversations", "issues"],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    href: "/reports",
    keywords: ["analytics", "dashboard"],
  },
];

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
  }

  return entries;
}

export const STATIC_INDEX: SearchEntry[] = buildIndex();
