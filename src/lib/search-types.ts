export type SearchResult = {
  id: string;
  label: string;
  secondary?: string;
  href: string;
};

export type SearchResponse = {
  customers: SearchResult[];
  tickets: SearchResult[];
  surveys: SearchResult[];
  teamMembers: SearchResult[];
  responses: SearchResult[];
};
