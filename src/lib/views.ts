export type ViewDef = {
  id: string;
  label: string;
};

export const TICKET_VIEWS: ViewDef[] = [
  { id: "all", label: "All tickets" },
  { id: "open", label: "Open" },
  { id: "unassigned", label: "Unassigned" },
  { id: "rated", label: "Rated" },
  { id: "detractors", label: "Detractors" },
  { id: "not-fired", label: "Survey not fired" },
  { id: "this-week", label: "This week" },
];

export const RESPONSE_VIEWS: ViewDef[] = [
  { id: "all", label: "All responses" },
  { id: "detractors", label: "Detractors" },
  { id: "promoters", label: "Promoters" },
  { id: "with-comments", label: "With comments" },
  { id: "this-week", label: "This week" },
];

export const CUSTOMER_VIEWS: ViewDef[] = [
  { id: "all", label: "All customers" },
  { id: "elite", label: "Elite" },
  { id: "gold", label: "Gold" },
  { id: "insider", label: "Insider" },
  { id: "b2b", label: "B2B accounts" },
  { id: "at-risk", label: "At risk" },
];

export const TEAM_MEMBER_VIEWS: ViewDef[] = [
  { id: "all", label: "All members" },
  { id: "front-line", label: "Front line" },
  { id: "senior", label: "Senior" },
  { id: "specialist", label: "Specialist" },
  { id: "low-performers", label: "Low performers" },
];
