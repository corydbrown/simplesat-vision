export type SearchResult = {
  id: string;
  label: string;
  secondary?: string;
  href: string;
  // Set on team-member results so the palette can render the agent's
  // stored avatar color. Other entity groups derive a color from the
  // label at render time.
  avatarColor?: string;
};

export type SearchResponse = {
  customers: SearchResult[];
  tickets: SearchResult[];
  surveys: SearchResult[];
  teamMembers: SearchResult[];
  responses: SearchResult[];
};
