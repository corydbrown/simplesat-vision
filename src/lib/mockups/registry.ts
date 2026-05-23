/** Mockup registry. Workers add their entry when they ship a variation and
 *  flip `ready: true`. The gallery at `/mockups` reads this list and renders
 *  the cards. Keep entries ordered within a theme. */

export type MockupStatus = "exploring" | "loved" | "rejected" | "promoted";
export type SufAxis = "simple" | "useful" | "fun";

export type MockupMeta = {
  theme: string;
  variant: string;
  title: string;
  hypothesis: string;
  sufAxis: SufAxis;
  status: MockupStatus;
  /** Set to true when the variant page exists at `path`. Until then the
   *  gallery shows it as a placeholder ("not yet built"). */
  ready: boolean;
  path: string;
  createdAt: string;
};

export const MOCKUPS: MockupMeta[] = [
  {
    theme: "qa-window",
    variant: "compact",
    title: "Compact horizontal",
    hypothesis:
      "All 5 categories on one row as pill clusters. Edit + history + coaching collapse behind interaction. Goal: see the whole evaluation at a glance, drill in only when needed.",
    sufAxis: "simple",
    status: "exploring",
    ready: false,
    path: "/mockups/qa-window/compact",
    createdAt: "2026-05-23",
  },
  {
    theme: "qa-window",
    variant: "guided",
    title: "Guided one-at-a-time",
    hypothesis:
      "Walks the manager through categories sequentially. Score → reason → advance. One primary action per step — no choice paralysis, no parallel state to track.",
    sufAxis: "simple",
    status: "exploring",
    ready: false,
    path: "/mockups/qa-window/guided",
    createdAt: "2026-05-23",
  },
  {
    theme: "qa-window",
    variant: "overlay",
    title: "Conversation overlay",
    hypothesis:
      "QA section becomes a floating right-sidebar over the message feed. Click a category, supporting messages light up in the feed. Direct manipulation of the evidence ↔ score connection.",
    sufAxis: "fun",
    status: "exploring",
    ready: true,
    path: "/mockups/qa-window/overlay",
    createdAt: "2026-05-23",
  },
  {
    theme: "qa-window",
    variant: "splitpane",
    title: "Split-pane evidence",
    hypothesis:
      "Dedicated full-page review mode: messages left, score panel right. Clicking a category scrolls + highlights supporting messages. Optimizes for the manager-review work session, not the ticket-detail browse.",
    sufAxis: "useful",
    status: "exploring",
    ready: false,
    path: "/mockups/qa-window/splitpane",
    createdAt: "2026-05-23",
  },
];
